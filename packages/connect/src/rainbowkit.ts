import type { AximConnectorOptions, AximWalletConfig } from "./types.js";

const AXIM_ICON = "https://docs.axim.one/assets/axim-icon.png"; // TODO: final asset
// Path B: no public WalletConnect Cloud Explorer registration — the deep link
// is supplied directly here, so AlphaSec can add Axim as a RainbowKit custom wallet.
const DEEPLINK_BASE = "https://link.axim.one/wc";

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
