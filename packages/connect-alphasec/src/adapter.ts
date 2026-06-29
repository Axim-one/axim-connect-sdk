import {
  AximError,
  errNotConnected,
  errNotImplemented,
  type Address,
  type Balance,
  type Eip1193Provider,
  type SessionGrant,
  type TokenRef,
  type TxResult,
  type VenueAdapter,
} from "@axim/connect";
import { API_BASE, NETWORKS, type Network } from "./contracts.js";
import { resolveToken } from "./units.js";

export interface AlphaSecAdapterOptions {
  /** EIP-1193 provider from @axim/connect (master signer over WalletConnect). */
  provider: Eip1193Provider;
  network?: Network;
  /** Override the REST API base. */
  apiBase?: string;
}

interface WalletBalanceResponse {
  code: number;
  result?: { balances?: { tokenId: string; locked: string; unlocked: string }[] };
}

/**
 * AlphaSec venue adapter. Isolates all AlphaSec-specific signing/submission.
 * The master wallet (Axim over WC) signs only: session authorization, deposit,
 * withdraw. Trading / session-wallet order signing belongs to AlphaSec.
 *
 * Preview: signing methods are stubs against the frozen interface;
 * `getVenueBalance` is implemented (read-only REST).
 */
export class AlphaSecAdapter implements VenueAdapter {
  private readonly provider: Eip1193Provider;
  private readonly network: Network;
  private readonly net: (typeof NETWORKS)[Network];
  private readonly apiBase: string;

  constructor(opts: AlphaSecAdapterOptions) {
    this.provider = opts.provider;
    this.network = opts.network ?? "mainnet";
    this.net = NETWORKS[this.network];
    this.apiBase = opts.apiBase ?? API_BASE[this.network];
  }

  private async address(): Promise<Address> {
    const accounts = await this.provider.request<Address[]>({ method: "eth_accounts" });
    const addr = accounts[0];
    if (!addr) throw errNotConnected();
    return addr;
  }

  /**
   * Authorize the L2 session wallet. EIP-712 `RegisterSessionWallet`
   * (eth_signTypedData_v4) + L2 tx (to=MatchEngine, command 0x01, gasPrice 0),
   * submitted to POST /api/v1/wallet/session. One-time per session.
   */
  async authorizeSession(_opts?: { expiryDays?: number; name?: string }): Promise<SessionGrant> {
    void this.net; // session tx targets net.l2.matchEngine
    throw errNotImplemented("AlphaSecAdapter.authorizeSession");
  }

  /**
   * Deposit from Kaia L1 to AlphaSec L2. ERC20: approve →
   * L1GatewayRouter.outboundTransfer (eth_sendTransaction on L1).
   * Gas paid in KAIA; sponsored via Axim fee delegation (wallet side).
   */
  async deposit(token: TokenRef, amount: string): Promise<TxResult> {
    const { id, decimals } = resolveToken(token);
    void id;
    void decimals;
    void amount; // parseAmount(token, amount) → base units when wiring tx
    throw errNotImplemented("AlphaSecAdapter.deposit");
  }

  /**
   * Withdraw from AlphaSec L2 to Kaia L1. Gas-free L2 tx
   * (L2GatewayRouter.outboundTransfer / ArbSys for KAIA, gasPrice 0),
   * submitted to POST /api/v1/wallet/withdraw. L1 settlement is automatic.
   */
  async withdraw(token: TokenRef, amount: string, _to?: Address): Promise<TxResult> {
    resolveToken(token);
    void amount;
    throw errNotImplemented("AlphaSecAdapter.withdraw");
  }

  /** Read L2 balance via GET /api/v1/wallet/balance. */
  async getVenueBalance(token: TokenRef): Promise<Balance> {
    const { id } = resolveToken(token);
    const address = await this.address();
    const res = await fetch(`${this.apiBase}/api/v1/wallet/balance?address=${address}`);
    if (!res.ok) {
      throw new AximError("REQUEST_FAILED", `GET /wallet/balance failed: ${res.status}`);
    }
    const json = (await res.json()) as WalletBalanceResponse;
    const row = json.result?.balances?.find((b) => Number(b.tokenId) === id);
    return { token, locked: row?.locked ?? "0", unlocked: row?.unlocked ?? "0" };
  }
}
