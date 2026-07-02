import type { ChainConfig } from "./chains.js";

/** Minimal EIP-1193 provider surface used across the SDK. */
export interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
  on(event: "accountsChanged" | "chainChanged" | "disconnect", handler: (payload: unknown) => void): void;
  removeListener(event: string, handler: (payload: unknown) => void): void;
}

export type Address = `0x${string}`;

export interface AximConnectorOptions {
  /** WalletConnect Cloud project id. */
  projectId: string;
  /** Attribution id carried in the WC session metadata (e.g. "alphasec"). */
  appId: string;
  /** Allowed chains. Defaults to [kaia]. The provider is scoped to these. */
  chains?: ChainConfig[];
  /** Optional override of the relay url. */
  relayUrl?: string;
}

export type ConnectorStatus = "disconnected" | "connecting" | "connected";

export interface ConnectResult {
  address: Address;
  chainId: number;
}

/** Connector event payloads. */
export interface AximConnectorEvents {
  connect: ConnectResult;
  disconnect: void;
  accountsChanged: Address[];
  chainChanged: number;
}
export type AximConnectorEvent = keyof AximConnectorEvents;

export interface AximConnector {
  /** Establish a WalletConnect v2 session (or resume an existing one). */
  connect(): Promise<ConnectResult>;
  /** Resume a persisted session if present; otherwise null. "Connect once, stay connected." */
  resume(): Promise<ConnectResult | null>;
  /** Tear down the session. */
  disconnect(): Promise<void>;
  /** Standard EIP-1193 provider. Throws if not connected. */
  getProvider(): Eip1193Provider;
  /** Current connection status. */
  getStatus(): ConnectorStatus;
  on<E extends AximConnectorEvent>(event: E, handler: (payload: AximConnectorEvents[E]) => void): void;
  off<E extends AximConnectorEvent>(event: E, handler: (payload: AximConnectorEvents[E]) => void): void;
}

/** Token reference: symbol or numeric venue token id (1 = KAIA, 2 = USDT). */
export type TokenRef = "USDT" | "KAIA" | number;

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
  mobile?: { getUri: (uri: string) => string };
  qrCode?: {
    getUri: (uri: string) => string;
    instructions?: {
      learnMoreUrl?: string;
      steps: { step: string; title: string; description: string }[];
    };
  };
  /** Store / download links surfaced by RainbowKit's wallet UI. */
  downloadUrls?: {
    android?: string;
    ios?: string;
    chrome?: string;
    qrCode?: string;
    mobile?: string;
    browserExtension?: string;
  };
  // Structural: RainbowKit's real `createConnector` type needs wagmi, which we
  // do not import. Callers inject the concrete factory (see aximWallet).
  createConnector: unknown;
}
