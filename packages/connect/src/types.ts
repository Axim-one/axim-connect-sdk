/** Minimal EIP-1193 provider surface used across the SDK. */
export interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
  on(event: "accountsChanged" | "chainChanged" | "disconnect", handler: (payload: unknown) => void): void;
  removeListener(event: string, handler: (payload: unknown) => void): void;
}

export interface AximConnectorOptions {
  /** WalletConnect Cloud project id. */
  projectId: string;
  /** Attribution id carried in the WC session metadata (e.g. "alphasec"). */
  appId: string;
  /** Allowed EVM chain ids. Defaults to [8217] (Kaia mainnet). */
  chains?: number[];
  /** Optional override of the relay url. */
  relayUrl?: string;
}

export interface AximConnector {
  /** Returns a standard EIP-1193 provider (lazily initialized). */
  getProvider(): Eip1193Provider;
  /** Tear down the WC session. */
  disconnect(): Promise<void>;
}

/** Token reference: symbol or numeric venue token id (1 = KAIA, 2 = USDT). */
export type TokenRef = "USDT" | "KAIA" | number;
export type Address = `0x${string}`;

export interface SessionGrant {
  sessionAddress: Address;
  /** Unix seconds. */
  expiry: number;
  /** Whether the session wallet is active on-chain. */
  applied: boolean;
}

export interface TxResult {
  txHash: string;
}

export interface Balance {
  token: TokenRef;
  /** Locked in open orders (not withdrawable). */
  locked: string;
  /** Available for trading/withdrawal. */
  unlocked: string;
}

/**
 * Venue-specific flows, isolated from the core. Implemented per venue
 * (e.g. AlphaSecAdapter in @axim/connect-alphasec).
 */
export interface VenueAdapter {
  authorizeSession(opts?: { expiryDays?: number; name?: string }): Promise<SessionGrant>;
  deposit(token: TokenRef, amount: string): Promise<TxResult>;
  withdraw(token: TokenRef, amount: string, to?: Address): Promise<TxResult>;
  getVenueBalance(token: TokenRef): Promise<Balance>;
}

/**
 * Minimal RainbowKit-compatible custom wallet shape. Mirrors
 * `@rainbow-me/rainbowkit`'s `Wallet` without taking a hard dependency.
 */
export interface AximWalletConfig {
  id: string;
  name: string;
  iconUrl: string | (() => Promise<string>);
  iconBackground: string;
  /** RainbowKit calls this with the WC uri to build the mobile deep link. */
  mobile?: { getUri: (uri: string) => string };
  /** Desktop QR fallback. */
  qrCode?: { getUri: (uri: string) => string };
  createConnector: unknown;
}
