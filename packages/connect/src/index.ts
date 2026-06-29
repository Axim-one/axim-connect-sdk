export * from "./types.js";
export * from "./errors.js";
export * from "./chains.js";
export { aximWallet } from "./rainbowkit.js";

import { kaia } from "./chains.js";
import { errNotConnected, errNotImplemented } from "./errors.js";
import type {
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
 * Preview: transport wiring (WalletConnect UniversalProvider) is not yet
 * implemented; the contract below is frozen against the SDK spec.
 */
export function createAximConnector(opts: AximConnectorOptions): AximConnector {
  const chains = opts.chains ?? [kaia];
  void opts.appId; // injected into WC session metadata on connect() for attribution

  let status: ConnectorStatus = "disconnected";
  let provider: Eip1193Provider | undefined;
  const listeners = new Map<AximConnectorEvent, Set<(p: unknown) => void>>();

  function emit<E extends AximConnectorEvent>(event: E, payload: AximConnectorEvents[E]): void {
    listeners.get(event)?.forEach((h) => h(payload as unknown));
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
      if (!provider) throw errNotConnected();
      return provider;
    },

    async connect(): Promise<ConnectResult> {
      status = "connecting";
      void chains; // scope the WC session to these chains
      // TODO: open/resume a WalletConnect v2 UniversalProvider session, inject
      // `appId` into session metadata, build the EIP-1193 provider, wire events,
      // then set status = "connected" and emit("connect", result).
      status = "disconnected";
      throw errNotImplemented("createAximConnector.connect");
    },

    async resume(): Promise<ConnectResult | null> {
      // TODO: restore a persisted WC session (topic + keys) if present.
      return null;
    },

    async disconnect(): Promise<void> {
      provider = undefined;
      status = "disconnected";
      emit("disconnect", undefined);
    },
  };
}
