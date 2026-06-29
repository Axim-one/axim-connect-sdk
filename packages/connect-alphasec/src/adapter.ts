import type {
  Address,
  Balance,
  Eip1193Provider,
  SessionGrant,
  TokenRef,
  TxResult,
  VenueAdapter,
} from "@axim/connect";
import { API_BASE, NETWORKS, type Network, TOKENS } from "./contracts.js";

export interface AlphaSecAdapterOptions {
  /** EIP-1193 provider from @axim/connect (master signer over WalletConnect). */
  provider: Eip1193Provider;
  network?: Network;
  /** Override the REST API base. */
  apiBase?: string;
}

function tokenId(token: TokenRef): number {
  if (typeof token === "number") return token;
  return TOKENS[token].id;
}

/**
 * AlphaSec venue adapter. Isolates all AlphaSec-specific signing/submission.
 * The master wallet (Axim over WC) signs only: session authorization, deposit, withdraw.
 * Trading / session-wallet order signing belongs to AlphaSec and is NOT handled here.
 *
 * Preview: method bodies are stubs against the frozen interface.
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
    void this.provider;
    void this.net;
    void this.apiBase;
  }

  /**
   * Authorize the L2 session wallet. EIP-712 `RegisterSessionWallet`
   * (eth_signTypedData_v4) + L2 tx (to=MatchEngine, command 0x01, gasPrice 0),
   * submitted to POST /api/v1/wallet/session. One-time per session.
   */
  async authorizeSession(_opts?: { expiryDays?: number; name?: string }): Promise<SessionGrant> {
    throw new Error("AlphaSecAdapter.authorizeSession: not yet implemented (preview).");
  }

  /**
   * Deposit USDT from Kaia L1 to AlphaSec L2. ERC20: approve →
   * L1GatewayRouter.outboundTransfer (eth_sendTransaction on L1).
   * Gas paid in KAIA; sponsored via Axim fee delegation (wallet side).
   */
  async deposit(token: TokenRef, _amount: string): Promise<TxResult> {
    void tokenId(token);
    throw new Error("AlphaSecAdapter.deposit: not yet implemented (preview).");
  }

  /**
   * Withdraw USDT from AlphaSec L2 to Kaia L1. Gas-free L2 tx
   * (L2GatewayRouter.outboundTransfer / ArbSys for KAIA, gasPrice 0),
   * submitted to POST /api/v1/wallet/withdraw. L1 settlement is automatic.
   */
  async withdraw(token: TokenRef, _amount: string, _to?: Address): Promise<TxResult> {
    void tokenId(token);
    throw new Error("AlphaSecAdapter.withdraw: not yet implemented (preview).");
  }

  /** Read L2 balance via GET /api/v1/wallet/balance. */
  async getVenueBalance(token: TokenRef): Promise<Balance> {
    void tokenId(token);
    throw new Error("AlphaSecAdapter.getVenueBalance: not yet implemented (preview).");
  }
}
