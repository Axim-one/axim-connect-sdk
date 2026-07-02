import type { AximConnectorOptions, AximWalletConfig } from "./types.js";

const AXIM_ICON = "https://www.axim.one/assets/axim-icon.png"; // TODO: final asset URL
// Path B: no public WalletConnect Cloud Explorer registration — the deep link is
// supplied directly here so AlphaSec can add Axim as a RainbowKit custom wallet.
// Verified from axim-app: universal link https://www.axim.one, custom scheme axim://.
// The app must handle the /wc?uri= route (WC pairing) — see A3.
const DEEPLINK_BASE = "https://www.axim.one/wc"; // fallback scheme: axim://wc?uri=

/**
 * RainbowKit custom wallet for Axim. Use inside `connectorsForWallets`.
 * Mobile deep link is provided directly (no registry dependency).
 */
export function aximWallet(opts: AximConnectorOptions): AximWalletConfig {
  void opts; // forwarded into the connector once transport is wired
  return {
    id: "axim",
    name: "Axim",
    iconUrl: AXIM_ICON,
    iconBackground: "#0F1B3D",
    mobile: { getUri: (uri: string) => `${DEEPLINK_BASE}?uri=${encodeURIComponent(uri)}` },
    qrCode: { getUri: (uri: string) => uri },
    // TODO: back this with createAximConnector(opts) + RainbowKit's getWalletConnectConnector.
    createConnector: () => {
      throw new Error("@axim/connect: aximWallet connector not yet implemented (preview).");
    },
  };
}
