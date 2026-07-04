import {
  AximError,
  errNotConnected,
  type Address,
  type Balance,
  type Eip1193Provider,
  type RevokeResult,
  type SessionGrant,
  type TokenRef,
  type TxResult,
  type VenueAdapter,
} from "@axim/connect";
import {
  encodeFunctionData,
  getAddress,
  numberToHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  API_BASE,
  ARBSYS_ABI,
  BRIDGE_FEE_DEFAULT_WEI,
  BRIDGE_GAS_PRICE_BID,
  BRIDGE_MAX_GAS,
  DEX_COMMAND,
  SESSION_ENDPOINTS,
  ERC20_ABI,
  INBOX_ABI,
  L1_GATEWAY_ROUTER_ABI,
  L2_DEFAULT_GAS,
  L2_GATEWAY_ROUTER_ABI,
  NETWORKS,
  SESSION_SUBTYPE,
  USDT_L1,
  sessionDomain,
  type Network,
} from "./contracts.js";
import {
  concatHex,
  encodeBridgeExtraData,
  getGateway,
  toHex,
  utf8ToHex,
} from "./encoding.js";
import { parseAmount, resolveToken } from "./units.js";

export interface AlphaSecAdapterOptions {
  /** EIP-1193 provider from @axim/connect (master signer over WalletConnect). */
  provider: Eip1193Provider;
  network?: Network;
  /** Override the REST API base. */
  apiBase?: string;
  /**
   * Override the USDT L1 (Kaia) token address. AlphaSec docs ship a PLACEHOLDER
   * for this, so it is resolved at runtime from GET /api/v1/market/tokens.
   * Pass this to skip the lookup (e.g. once AlphaSec confirms the real address).
   */
  usdtL1Address?: Address;
  /**
   * Bridge fee (KAIA wei) sent as `value` on the L1 outboundTransfer and encoded
   * into `extraData`. Defaults to 0.01 KAIA (confirmed L2 execution + submission
   * cost per AlphaSec docs). Set to `0n` only if a sponsor covers it separately.
   */
  bridgeFeeWei?: bigint;
  /**
   * Override the `fetch` used for AlphaSec REST calls (session submit, withdraw
   * submit, balance, market tokens). Defaults to the global `fetch`. Injecting a
   * mock here lets callers exercise the full sign/submit flow — the wallet still
   * signs for real — without a live AlphaSec backend (see the demo's mock mode).
   */
  fetchImpl?: typeof fetch;
}

interface WalletBalanceResponse {
  code: number;
  result?: { balances?: { tokenId: string; locked: string; unlocked: string }[] };
}

/** GET /api/v1/market/tokens — used to resolve the L1 address for a venue token. */
interface MarketTokensResponse {
  code?: number;
  result?: { tokens?: MarketToken[] } | MarketToken[];
}
interface MarketToken {
  id?: number | string;
  symbol?: string;
  l1Address?: string;
}

/**
 * REST responses for withdraw/session submission. The API returns a tx hash but
 * we do not fully trust its shape, so we model it loosely and extract robustly.
 */
interface SubmitTxResponse {
  code?: number;
  result?: { txHash?: string; applied?: boolean } | string;
}

/**
 * AlphaSec venue adapter. Isolates all AlphaSec-specific signing/submission.
 * The master wallet (Axim over WC) signs only: session authorization, deposit,
 * withdraw. Trading / session-wallet order signing belongs to AlphaSec.
 *
 * Status: `authorizeSession`, `deposit`, `withdraw` are now implemented against
 * the frozen interface + the O1 contract reference, but are RUNTIME-UNTESTED —
 * no flow has been exercised against a live Kaia L1/L2 node or the AlphaSec REST
 * API. All tx encoding uses viem. `getVenueBalance` is unchanged.
 */
export class AlphaSecAdapter implements VenueAdapter {
  private readonly provider: Eip1193Provider;
  private readonly network: Network;
  private readonly net: (typeof NETWORKS)[Network];
  private readonly apiBase: string;
  private readonly usdtL1Override?: Address;
  private readonly bridgeFeeWei: bigint;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AlphaSecAdapterOptions) {
    this.provider = opts.provider;
    this.network = opts.network ?? "mainnet";
    this.net = NETWORKS[this.network];
    this.apiBase = opts.apiBase ?? API_BASE[this.network];
    this.usdtL1Override = opts.usdtL1Address;
    this.bridgeFeeWei = opts.bridgeFeeWei ?? BRIDGE_FEE_DEFAULT_WEI;
    this.fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  }

  private async address(): Promise<Address> {
    const accounts = await this.provider.request<Address[]>({ method: "eth_accounts" });
    const addr = accounts[0];
    if (!addr) throw errNotConnected();
    return addr;
  }

  /** L2 nonce = millisecond timestamp (allows parallel L2 txs). */
  private timeNonce(): bigint {
    return BigInt(Date.now());
  }

  /**
   * Resolve the L1 (Kaia) address of a venue token. RESIDUAL-1: the USDT L1
   * address is a placeholder in AlphaSec docs, so we resolve it at runtime from
   * GET /api/v1/market/tokens (matching on the numeric venue token id). A
   * constructor override short-circuits the lookup. Missing/zero -> REQUEST_FAILED.
   */
  private async resolveL1Token(tokenId: number): Promise<Address> {
    if (this.usdtL1Override) return getAddress(this.usdtL1Override);

    // Confirmed per-network USDT L1 address (mainnet). Skips the placeholder in
    // /market/tokens (which returns Ethereum's USDT). resolveL1Token is USDT-only.
    const known = USDT_L1[this.network];
    if (known) return getAddress(known);

    const res = await this.fetchImpl(`${this.apiBase}/api/v1/market/tokens`);
    if (!res.ok) {
      throw new AximError("REQUEST_FAILED", `GET /market/tokens failed: ${res.status}`);
    }
    const json = (await res.json()) as MarketTokensResponse;
    const list: MarketToken[] = Array.isArray(json.result)
      ? json.result
      : json.result?.tokens ?? [];
    const row = list.find((t) => Number(t.id) === tokenId);
    const l1 = row?.l1Address;
    if (!l1 || /^0x0{40}$/i.test(l1)) {
      throw new AximError(
        "REQUEST_FAILED",
        `No L1 address for venue token id ${tokenId} in /market/tokens. ` +
          `Pass AlphaSecAdapterOptions.usdtL1Address to override.`,
      );
    }
    return getAddress(l1);
  }

  /** POST a raw signed tx to a REST endpoint and extract the returned tx hash. */
  private async submitTx(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ txHash: string; applied?: boolean }> {
    const res = await this.fetchImpl(`${this.apiBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new AximError("REQUEST_FAILED", `POST ${path} failed: ${res.status}`);
    }
    const json = (await res.json()) as SubmitTxResponse;
    const result = json.result;
    let txHash: string | undefined;
    let applied: boolean | undefined;
    if (typeof result === "string") {
      txHash = result;
    } else if (result && typeof result === "object") {
      txHash = result.txHash;
      applied = result.applied;
    }
    if (!txHash) {
      throw new AximError("REQUEST_FAILED", `POST ${path} returned no txHash`);
    }
    return applied === undefined ? { txHash } : { txHash, applied };
  }

  /**
   * Authorize the L2 session wallet. EIP-712 `RegisterSessionWallet`
   * (eth_signTypedData_v4, domain chainId = L1) + gas-free L2 tx (to=MatchEngine,
   * command 0x01, gasPrice 0, tx chainId = L2), submitted to POST
   * /api/v1/wallet/session. One-time per session.
   *
   * ASSUMPTION (confirm with AlphaSec): when the caller does not pass
   * `sessionWallet`, the adapter GENERATES the session keypair and returns its
   * private key on `SessionGrant.sessionPrivateKey`. The master/Axim key never
   * signs orders — only this authorization. If AlphaSec expects the session key
   * to originate on their side instead, callers should pass `sessionWallet`.
   */
  async authorizeSession(opts?: {
    expiryDays?: number;
    name?: string;
    sessionWallet?: Address;
  }): Promise<SessionGrant> {
    const master = await this.address();

    // 1. Session wallet: caller-supplied or freshly generated.
    let sessionWallet: Address;
    let sessionPrivateKey: `0x${string}` | undefined;
    if (opts?.sessionWallet) {
      sessionWallet = getAddress(opts.sessionWallet);
    } else {
      sessionPrivateKey = generatePrivateKey();
      sessionWallet = privateKeyToAccount(sessionPrivateKey).address;
    }

    // 2. expiry + nonce. `nonce` MUST be identical across 712 msg / ctx / tx.
    const expiry = Math.floor(Date.now() / 1000) + (opts?.expiryDays ?? 30) * 86_400;
    const nonce = this.timeNonce();

    // 3. EIP-712 sign with the MASTER key. Domain chainId = L1.
    const domain = sessionDomain(this.network);
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        RegisterSessionWallet: [
          { name: "sessionWallet", type: "address" },
          { name: "expiry", type: "uint64" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "RegisterSessionWallet",
      domain,
      message: {
        sessionWallet,
        expiry: String(expiry),
        nonce: String(nonce),
      },
    };
    const l1signature = await this.provider.request<`0x${string}`>({
      method: "eth_signTypedData_v4",
      params: [master, JSON.stringify(typedData)],
    });

    // 4. L2 tx: to = MatchEngine, calldata = 0x01 || hex(utf8(SessionContext)).
    //    tx chainId = L2, gasPrice 0, value 0x0, gasLimit 0x30000, SAME nonce.
    const sessionContext = {
      type: SESSION_SUBTYPE.create,
      publickey: sessionWallet,
      expiresAt: expiry,
      nonce: Number(nonce),
      l1owner: master,
      l1signature,
    };
    // Command prefix is a single byte: 0x01. `toHex`/numberToHex would minimize
    // to "0x1" (a half-byte), corrupting the calldata — force one-byte width.
    const command = numberToHex(DEX_COMMAND.session, { size: 1 }); // 0x01
    const data = concatHex(command, utf8ToHex(JSON.stringify(sessionContext)));
    const signedTx = await this.provider.request<`0x${string}`>({
      method: "eth_signTransaction",
      params: [
        {
          from: master,
          to: this.net.l2.matchEngine,
          data,
          value: "0x0",
          gas: toHex(L2_DEFAULT_GAS),
          gasPrice: "0x0",
          chainId: toHex(this.net.l2ChainId),
          nonce: toHex(nonce),
        },
      ],
    });

    // 5. Submit.
    const submitted = await this.submitTx(SESSION_ENDPOINTS.create, {
      tx: signedTx,
      ...(opts?.name ? { name: opts.name } : {}),
    });

    // 6. SessionGrant. Include the private key only if we generated it.
    return {
      sessionAddress: sessionWallet,
      expiry,
      applied: submitted.applied ?? false,
      ...(sessionPrivateKey ? { sessionPrivateKey } : {}),
    };
  }

  /**
   * Revoke (delete) an authorized L2 session wallet — type-3 SessionContext.
   * Mirrors `authorizeSession`: the master EIP-712-signs a delete authorization
   * (domain chainId = L1) plus a gas-free L2 tx (to = MatchEngine, command 0x01,
   * `SessionContext.type = 3`), submitted to POST /api/v1/wallet/session/delete.
   * After this the session key can no longer sign orders at the venue.
   *
   * ASSUMPTION (confirm with AlphaSec): the delete authorization reuses the
   * `RegisterSessionWallet` EIP-712 type with `expiry = 0` to denote revocation.
   * The exact delete schema is UNVERIFIED — adjust once AlphaSec confirms.
   */
  async revokeSession(opts: { sessionWallet: Address; nonce?: bigint }): Promise<RevokeResult> {
    const master = await this.address();
    const sessionWallet = getAddress(opts.sessionWallet);
    const nonce = opts.nonce ?? this.timeNonce();
    const expiry = 0; // revoke: no validity window.

    // 1. EIP-712 delete authorization, signed by the MASTER. Domain chainId = L1.
    const domain = sessionDomain(this.network);
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        RegisterSessionWallet: [
          { name: "sessionWallet", type: "address" },
          { name: "expiry", type: "uint64" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "RegisterSessionWallet",
      domain,
      message: {
        sessionWallet,
        expiry: String(expiry),
        nonce: String(nonce),
      },
    };
    const l1signature = await this.provider.request<`0x${string}`>({
      method: "eth_signTypedData_v4",
      params: [master, JSON.stringify(typedData)],
    });

    // 2. Gas-free L2 tx: to = MatchEngine, calldata = 0x01 || hex(utf8(SessionContext type=3)).
    const sessionContext = {
      type: SESSION_SUBTYPE.delete,
      publickey: sessionWallet,
      nonce: Number(nonce),
      l1owner: master,
      l1signature,
    };
    const command = numberToHex(DEX_COMMAND.session, { size: 1 }); // 0x01
    const data = concatHex(command, utf8ToHex(JSON.stringify(sessionContext)));
    const signedTx = await this.provider.request<`0x${string}`>({
      method: "eth_signTransaction",
      params: [
        {
          from: master,
          to: this.net.l2.matchEngine,
          data,
          value: "0x0",
          gas: toHex(L2_DEFAULT_GAS),
          gasPrice: "0x0",
          chainId: toHex(this.net.l2ChainId),
          nonce: toHex(nonce),
        },
      ],
    });

    // 3. Submit to the delete endpoint.
    const submitted = await this.submitTx(SESSION_ENDPOINTS.delete, { tx: signedTx });
    return { applied: submitted.applied ?? false, txHash: submitted.txHash };
  }

  /**
   * Deposit from Kaia L1 to AlphaSec L2 via direct on-chain L1 txs (no REST).
   * ERC20 (USDT): approve(gateway, amount) then L1GatewayRouter.outboundTransfer.
   * Native KAIA: Inbox.depositEth() with value = amount (no approve).
   * Gas paid in KAIA by the master; fee delegation (if any) is the wallet's job.
   */
  async deposit(token: TokenRef, amount: string): Promise<TxResult> {
    const { id, symbol } = resolveToken(token);
    const master = await this.address();
    const value = parseAmount(token, amount);

    if (symbol === "KAIA") {
      // Native deposit: Inbox.depositEth(), value = amount, no approve.
      const data = encodeFunctionData({ abi: INBOX_ABI, functionName: "depositEth", args: [] });
      const txHash = await this.provider.request<`0x${string}`>({
        method: "eth_sendTransaction",
        params: [
          {
            from: master,
            to: this.net.l1.inbox,
            data,
            value: toHex(value),
            gas: toHex(500_000n),
          },
        ],
      });
      return { txHash };
    }

    // ERC20 path (USDT). RESIDUAL-1: resolve the real L1 token at runtime.
    const l1Token = await this.resolveL1Token(id);
    const router = this.net.l1.gatewayRouter;

    // Step 1: approve the per-token ERC20 gateway (spender = getGateway(l1Token)).
    const spender = await getGateway(this.provider, router, l1Token);
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, value],
    });
    const approveHash = await this.provider.request<`0x${string}`>({
      method: "eth_sendTransaction",
      params: [
        { from: master, to: l1Token, data: approveData, value: "0x0", gas: toHex(50_000n) },
      ],
    });
    // Await approval mining before the bridge call.
    await this.waitForReceipt(approveHash);

    // Step 2: outboundTransfer. RESIDUAL-2: bridge fee is a caller-overridable
    // `bridgeFeeWei` (default 0n) — never a silent nonzero. `to` = master (same
    // address on L2). extraData = abi.encode(uint256 bridgeFee, bytes "0x").
    const extraData = encodeBridgeExtraData(this.bridgeFeeWei);
    const bridgeData = encodeFunctionData({
      abi: L1_GATEWAY_ROUTER_ABI,
      functionName: "outboundTransfer",
      args: [l1Token, master, value, BRIDGE_MAX_GAS, BRIDGE_GAS_PRICE_BID, extraData],
    });
    const txHash = await this.provider.request<`0x${string}`>({
      method: "eth_sendTransaction",
      params: [
        {
          from: master,
          to: router,
          data: bridgeData,
          value: toHex(this.bridgeFeeWei),
          gas: toHex(500_000n),
        },
      ],
    });
    return { txHash };
  }

  /**
   * Withdraw from AlphaSec L2 to Kaia L1. Master signs a gas-free L2 tx
   * (gasPrice 0, tx chainId = L2, timeNonce) and POSTs the raw signed tx.
   * ERC20 (USDT): L2GatewayRouter.outboundTransfer(l1Token, l1Recipient, amount, "0x").
   * Native KAIA: ArbSys.withdrawEth(destination) with value = amount.
   */
  async withdraw(token: TokenRef, amount: string, to?: Address): Promise<TxResult> {
    const { id, symbol } = resolveToken(token);
    const master = await this.address();
    const value = parseAmount(token, amount);
    const l1Recipient = to ? getAddress(to) : master;
    const nonce = this.timeNonce();

    let target: Address;
    let data: `0x${string}`;
    let txValue: `0x${string}`;

    if (symbol === "KAIA") {
      target = this.net.l2.arbSys;
      data = encodeFunctionData({
        abi: ARBSYS_ABI,
        functionName: "withdrawEth",
        args: [l1Recipient],
      });
      txValue = toHex(value);
    } else {
      // ERC20: resolve the L1 USDT address (same runtime lookup as deposit).
      const l1Token = await this.resolveL1Token(id);
      target = this.net.l2.gatewayRouter;
      data = encodeFunctionData({
        abi: L2_GATEWAY_ROUTER_ABI,
        functionName: "outboundTransfer",
        args: [l1Token, l1Recipient, value, "0x"],
      });
      txValue = "0x0";
    }

    const signedTx = await this.provider.request<`0x${string}`>({
      method: "eth_signTransaction",
      params: [
        {
          from: master,
          to: target,
          data,
          value: txValue,
          gas: toHex(1_000_000n),
          gasPrice: "0x0",
          chainId: toHex(this.net.l2ChainId),
          nonce: toHex(nonce),
        },
      ],
    });

    const submitted = await this.submitTx("/api/v1/wallet/withdraw", { tx: signedTx });
    return { txHash: submitted.txHash };
  }

  /** Read L2 balance via GET /api/v1/wallet/balance. */
  async getVenueBalance(token: TokenRef): Promise<Balance> {
    const { id } = resolveToken(token);
    const address = await this.address();
    const res = await this.fetchImpl(`${this.apiBase}/api/v1/wallet/balance?address=${address}`);
    if (!res.ok) {
      throw new AximError("REQUEST_FAILED", `GET /wallet/balance failed: ${res.status}`);
    }
    const json = (await res.json()) as WalletBalanceResponse;
    const row = json.result?.balances?.find((b) => Number(b.tokenId) === id);
    return { token, locked: row?.locked ?? "0", unlocked: row?.unlocked ?? "0" };
  }

  /**
   * Poll the L1 receipt for a sent tx hash (used to serialize approve -> bridge).
   * RUNTIME-UNTESTED. Bounded polling; throws REQUEST_FAILED on timeout.
   */
  private async waitForReceipt(txHash: `0x${string}`, tries = 40, delayMs = 1_500): Promise<void> {
    for (let i = 0; i < tries; i++) {
      const receipt = await this.provider.request<{ status?: string } | null>({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt) {
        if (receipt.status && receipt.status !== "0x1") {
          throw new AximError("REQUEST_FAILED", `approve tx ${txHash} reverted`);
        }
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new AximError("REQUEST_FAILED", `Timed out waiting for approve receipt ${txHash}`);
  }
}
