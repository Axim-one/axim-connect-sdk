import { createConfig, http } from "wagmi";
import { kaia, kairos } from "viem/chains";
import {
  connectorsForWallets,
  getWalletConnectConnector,
  type Wallet,
} from "@rainbow-me/rainbowkit";
import { aximWallet } from "@axim/connect";

// WalletConnect Cloud project id — required for real pairing.
// Set VITE_WC_PROJECT_ID in an .env file (see README).
export const projectId = import.meta.env.VITE_WC_PROJECT_ID ?? "";

if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn(
    "[example] VITE_WC_PROJECT_ID is not set — the Connect modal will render but pairing needs a real project id.",
  );
}

/**
 * `aximWallet` returns @axim/connect's `AximWalletConfig`, which is structurally
 * a RainbowKit `Wallet`. We inject RainbowKit's `getWalletConnectConnector` so
 * `@axim/connect` keeps zero hard dependency on RainbowKit/wagmi. The cast below
 * is only needed because the SDK models `createConnector` as `unknown` (to avoid
 * importing wagmi types); at runtime it is exactly what RainbowKit expects.
 */
const axim = (): Wallet => {
  const w = aximWallet({ projectId, appId: "alphasec", getWalletConnectConnector }) as unknown as Wallet & {
    qrCode?: { getUri: (uri: string) => string; instructions?: unknown };
  };
  // QR encodes the Axim custom-scheme deep link. The app team is updating the
  // in-app scanner to accept `axim://wc?uri=` (unwrap to the raw wc: uri).
  if (w.qrCode) {
    w.qrCode = { ...w.qrCode, getUri: (uri: string) => `axim://wc?uri=${encodeURIComponent(uri)}` };
  }
  return w as Wallet;
};

// RainbowKit's getWalletConnectConnector throws if projectId is empty, so only
// build the connector when configured. Without it the app still renders and
// shows how to enable pairing (see App.tsx).
export const isConfigured = Boolean(projectId);

const connectors = isConfigured
  ? connectorsForWallets(
      [{ groupName: "Axim", wallets: [axim] }],
      { appName: "AlphaSec × Axim example", projectId },
    )
  : [];

// Kaia (8217) first = default chain for the AlphaSec MAINNET E2E.
export const config = createConfig({
  chains: [kaia, kairos],
  connectors,
  transports: {
    [kairos.id]: http(),
    [kaia.id]: http(),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
