export * from "./types.js";
export * from "./errors.js";
export * from "./chains.js";
export { aximWallet } from "./rainbowkit.js";

import UniversalProvider from "@walletconnect/universal-provider";
import { kaia } from "./chains.js";
import { AximError, errNotConnected, fromProviderError } from "./errors.js";
import type {
  Address,
  AximConnector,
  AximConnectorEvent,
  AximConnectorEvents,
  AximConnectorOptions,
  ConnectorStatus,
  ConnectResult,
  Eip1193Provider,
} from "./types.js";

/**
 * Create a branded Axim connector over WalletConnect v2.
 *
 * Lifecycle: `connect()` opens (or resumes) a persistent WC v2 session;
 * `resume()` restores a stored session without a new pairing ("connect once,
 * stay connected"); `disconnect()` tears it down. Subscribe to status with
 * `on("connect" | "disconnect" | "accountsChanged" | "chainChanged", ...)`.
 *
 * Status: transport wiring (WalletConnect UniversalProvider) is now
 * implemented against the frozen SDK contract, but is RUNTIME-UNTESTED — it has
 * not yet been exercised against a live WalletConnect relay or an end-to-end
 * pairing/session flow. The shapes below are grounded in the shipped
 * `@walletconnect/universal-provider` type declarations.
 */

/* -------------------------------------------------------------------------- */
/* Minimal local view of the UniversalProvider surface we depend on.          */
/* Kept intentionally narrow (strict-mode friendly, no `any`) so we do not     */
/* couple to the package's internal generic types beyond what we touch.        */
/* -------------------------------------------------------------------------- */

interface WcSessionNamespace {
  accounts?: string[];
}

interface WcSession {
  namespaces?: Record<string, WcSessionNamespace | undefined>;
}

interface WcConnectParams {
  optionalNamespaces?: Record<
    string,
    {
      methods: string[];
      chains: string[];
      events: string[];
      rpcMap?: Record<string, string>;
    }
  >;
  sessionProperties?: Record<string, string>;
}

interface WcProvider {
  session?: WcSession;
  request<T = unknown>(args: { method: string; params?: unknown[] | object }, chain?: string): Promise<T>;
  connect(opts: WcConnectParams): Promise<WcSession | undefined>;
  disconnect(): Promise<void>;
  on(event: string, listener: (payload: unknown) => void): void;
  removeListener(event: string, listener: (payload: unknown) => void): void;
}

interface WcProviderInit {
  init(opts: {
    projectId: string;
    relayUrl?: string;
    metadata: { name: string; description: string; url: string; icons: string[] };
  }): Promise<WcProvider>;
}

// The package exposes a default export (also re-exported as the named
// `UniversalProvider`). We consume it through the narrow init interface above.
const WcUniversalProvider = UniversalProvider as unknown as WcProviderInit;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const EIP155_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
  "eth_accounts",
  "eth_requestAccounts",
  "eth_chainId",
];

const EIP155_EVENTS = ["chainChanged", "accountsChanged"];

/** Parse a CAIP-10 account string `eip155:8217:0xABC` → `{ address, chainId }`. */
function parseCaip10Account(account: string): { address: Address; chainId: number } {
  const parts = account.split(":");
  if (parts.length !== 3) {
    throw new AximError("REQUEST_FAILED", `Malformed CAIP-10 account: "${account}"`);
  }
  const [, chainPart, address] = parts;
  const chainId = Number(chainPart);
  if (!Number.isFinite(chainId) || !address) {
    throw new AximError("REQUEST_FAILED", `Malformed CAIP-10 account: "${account}"`);
  }
  return { address: address as Address, chainId };
}

/** Derive the connect result from a WC session's eip155 accounts. */
function resultFromSession(session: WcSession | undefined): ConnectResult {
  const accounts = session?.namespaces?.eip155?.accounts;
  const first = accounts?.[0];
  if (!first) {
    throw new AximError("REQUEST_FAILED", "No eip155 accounts in WalletConnect session");
  }
  return parseCaip10Account(first);
}

/** Parse a chainId that may arrive as hex (`0x2019`), decimal string, or CAIP-2. */
function parseChainId(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    // CAIP-2 form "eip155:8217" → take the reference.
    const value = raw.includes(":") ? raw.split(":").pop() ?? raw : raw;
    return value.startsWith("0x") ? parseInt(value, 16) : Number(value);
  }
  return NaN;
}

/* -------------------------------------------------------------------------- */
/* Connector                                                                  */
/* -------------------------------------------------------------------------- */

export function createAximConnector(opts: AximConnectorOptions): AximConnector {
  const chains = opts.chains ?? [kaia];
  const appId = opts.appId; // carried into the WC session via sessionProperties

  let status: ConnectorStatus = "disconnected";
  let wc: WcProvider | undefined;
  let providerView: Eip1193Provider | undefined;
  const listeners = new Map<AximConnectorEvent, Set<(p: unknown) => void>>();

  // Bound provider-event handlers, retained so disconnect() can remove them.
  let boundHandlers:
    | {
        accountsChanged: (payload: unknown) => void;
        chainChanged: (payload: unknown) => void;
        sessionEvent: (payload: unknown) => void;
        disconnect: (payload: unknown) => void;
        sessionDelete: (payload: unknown) => void;
        displayUri: (payload: unknown) => void;
      }
    | undefined;

  function emit<E extends AximConnectorEvent>(event: E, payload: AximConnectorEvents[E]): void {
    listeners.get(event)?.forEach((h) => h(payload as unknown));
  }

  function buildOptionalNamespaces(): NonNullable<WcConnectParams["optionalNamespaces"]> {
    const rpcMap: Record<string, string> = {};
    const caipChains: string[] = [];
    for (const chain of chains) {
      caipChains.push(`eip155:${chain.id}`);
      const url = chain.rpcUrls.default.http[0];
      if (url) rpcMap[String(chain.id)] = url;
    }
    return {
      eip155: {
        methods: EIP155_METHODS,
        chains: caipChains,
        events: EIP155_EVENTS,
        rpcMap,
      },
    };
  }

  /** An EIP-1193 view over the UniversalProvider (adapts the extra `chain` arg away). */
  function makeProviderView(p: WcProvider): Eip1193Provider {
    return {
      request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T> {
        return p.request<T>(args);
      },
      on(event, handler) {
        p.on(event, handler);
      },
      removeListener(event, handler) {
        p.removeListener(event, handler);
      },
    };
  }

  function wireEvents(p: WcProvider): void {
    if (boundHandlers) return; // already wired

    const handlers = {
      accountsChanged: (payload: unknown) => {
        const accounts = Array.isArray(payload) ? (payload as string[]) : [];
        emit("accountsChanged", accounts.map((a) => a as Address));
      },
      chainChanged: (payload: unknown) => {
        const chainId = parseChainId(payload);
        if (Number.isFinite(chainId)) emit("chainChanged", chainId);
      },
      // Fallback path: some flows surface changes via `session_event` only.
      sessionEvent: (payload: unknown) => {
        const p2 = payload as { event?: { name?: string; data?: unknown }; chainId?: string } | undefined;
        const name = p2?.event?.name;
        if (name === "accountsChanged") {
          const data = p2?.event?.data;
          const accounts = Array.isArray(data) ? (data as string[]) : [];
          emit("accountsChanged", accounts.map((a) => a as Address));
        } else if (name === "chainChanged") {
          const chainId = parseChainId(p2?.event?.data ?? p2?.chainId);
          if (Number.isFinite(chainId)) emit("chainChanged", chainId);
        }
      },
      disconnect: () => {
        reset();
        emit("disconnect", undefined);
      },
      sessionDelete: () => {
        reset();
        emit("disconnect", undefined);
      },
      // Contract has no `uri` event (frozen). Attach a no-op / debug-only sink.
      displayUri: (uri: unknown) => {
        // eslint-disable-next-line no-console
        console.debug("[axim/connect] WalletConnect display_uri", uri);
      },
    };

    p.on("accountsChanged", handlers.accountsChanged);
    p.on("chainChanged", handlers.chainChanged);
    p.on("session_event", handlers.sessionEvent);
    p.on("disconnect", handlers.disconnect);
    p.on("session_delete", handlers.sessionDelete);
    p.on("display_uri", handlers.displayUri);

    boundHandlers = handlers;
  }

  function unwireEvents(p: WcProvider): void {
    if (!boundHandlers) return;
    p.removeListener("accountsChanged", boundHandlers.accountsChanged);
    p.removeListener("chainChanged", boundHandlers.chainChanged);
    p.removeListener("session_event", boundHandlers.sessionEvent);
    p.removeListener("disconnect", boundHandlers.disconnect);
    p.removeListener("session_delete", boundHandlers.sessionDelete);
    p.removeListener("display_uri", boundHandlers.displayUri);
    boundHandlers = undefined;
  }

  /** Clear local connection state (does not talk to the network). */
  function reset(): void {
    if (wc) unwireEvents(wc);
    providerView = undefined;
    status = "disconnected";
  }

  async function ensureProvider(): Promise<WcProvider> {
    if (wc) return wc;
    wc = await WcUniversalProvider.init({
      projectId: opts.projectId,
      ...(opts.relayUrl ? { relayUrl: opts.relayUrl } : {}),
      metadata: {
        name: "Axim",
        description: "Axim Wallet",
        url: "https://www.axim.one",
        icons: ["https://www.axim.one/assets/axim-icon.png"],
      },
    });
    return wc;
  }

  return {
    getStatus: () => status,

    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler as (p: unknown) => void);
    },

    off(event, handler) {
      listeners.get(event)?.delete(handler as (p: unknown) => void);
    },

    getProvider(): Eip1193Provider {
      if (!providerView) throw errNotConnected();
      return providerView;
    },

    async connect(): Promise<ConnectResult> {
      status = "connecting";
      try {
        const p = await ensureProvider();

        // Reuse an existing session rather than forcing a fresh pairing.
        let session = p.session;
        if (!session) {
          session = await p.connect({
            optionalNamespaces: buildOptionalNamespaces(),
            // Carry appId for attribution in the session record. WC has no
            // dedicated attribution slot, so we use sessionProperties (a
            // free-form string map surfaced to the wallet).
            sessionProperties: { appId },
          });
        }

        const result = resultFromSession(session ?? p.session);
        wireEvents(p);
        providerView = makeProviderView(p);
        status = "connected";
        emit("connect", result);
        return result;
      } catch (e) {
        reset();
        if (e instanceof AximError) throw e;
        throw fromProviderError(e);
      }
    },

    async resume(): Promise<ConnectResult | null> {
      try {
        const p = await ensureProvider();
        if (!p.session) return null; // no persisted session — do NOT pair.

        const result = resultFromSession(p.session);
        wireEvents(p);
        providerView = makeProviderView(p);
        status = "connected";
        emit("connect", result);
        return result;
      } catch (e) {
        reset();
        if (e instanceof AximError) throw e;
        throw fromProviderError(e);
      }
    },

    async disconnect(): Promise<void> {
      const p = wc;
      if (p) {
        try {
          await p.disconnect();
        } catch {
          // Swallow: teardown must succeed locally even if the relay call fails.
        }
        unwireEvents(p);
      }
      wc = undefined;
      providerView = undefined;
      status = "disconnected";
      emit("disconnect", undefined);
    },
  };
}
