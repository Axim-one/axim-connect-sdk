import type { AximConnectorOptions, AximWalletConfig } from "./types.js";

const AXIM_ICON = "https://www.axim.one/assets/axim-icon.png"; // TODO: final asset URL
// Path B: no public WalletConnect Cloud Explorer registration — the deep link is
// supplied directly here so AlphaSec can add Axim as a RainbowKit custom wallet.
// Verified from axim-app: universal link https://www.axim.one, custom scheme axim://.
// The app must handle the /wc?uri= route (WC pairing) — see A3.
const DEEPLINK_BASE = "https://www.axim.one/wc"; // fallback scheme: axim://wc?uri=

/** RainbowKit's `getWalletConnectConnector`, injected to avoid a hard dependency. */
export type GetWalletConnectConnector = (params: { projectId: string }) => unknown;

export interface AximWalletOptions extends AximConnectorOptions {
  /**
   * Pass RainbowKit's `getWalletConnectConnector` here (from `@rainbow-me/rainbowkit`).
   * Injected so `@axim/connect` takes no hard dependency on RainbowKit/wagmi.
   */
  getWalletConnectConnector: GetWalletConnectConnector;
  /** Optional store/download links surfaced by RainbowKit. */
  downloadUrls?: AximWalletConfig["downloadUrls"];
}

/**
 * RainbowKit custom wallet for Axim (Path B). Use inside `connectorsForWallets`.
 *
 * The mobile deep link is provided directly here — there is no WalletConnect
 * Cloud Explorer registry entry. On mobile, RainbowKit hands the raw WC pairing
 * uri to `mobile.getUri`, which we wrap into the Axim deep link so the Axim app
 * opens straight to the pairing screen. On desktop, RainbowKit renders a QR of
 * the raw WC uri (`qrCode.getUri`) for the Axim app to scan.
 *
 * RainbowKit/wagmi are NOT dependencies of this package. The caller injects
 * `getWalletConnectConnector` (structurally typed as `unknown`) so we never
 * import from an uninstalled package. The value it returns is exactly what
 * RainbowKit expects for `createConnector`.
 *
 * Status: RUNTIME-UNTESTED — the deep-link wrapping and injected-connector
 * wiring have not been exercised against a live RainbowKit + wagmi app or a
 * real end-to-end pairing flow.
 */
export function aximWallet(opts: AximWalletOptions): AximWalletConfig {
  // appId attribution: on the RainbowKit path the actual WC session is created
  // by RainbowKit/wagmi's own WalletConnect connector (produced by the injected
  // getWalletConnectConnector), which owns the WC `sessionProperties`. We have
  // no hook to inject appId there without fabricating an API, so it is not
  // forwarded here. (Our non-RainbowKit createAximConnector carries appId via
  // sessionProperties — see index.ts.) Reference it so it is not flagged unused.
  void opts.appId;

  return {
    id: "axim",
    name: "Axim",
    iconUrl: AXIM_ICON,
    iconBackground: "#0F1B3D",
    // Wrap the raw WC uri into the Axim deep link — the whole point of Path B.
    mobile: { getUri: (uri: string) => `${DEEPLINK_BASE}?uri=${encodeURIComponent(uri)}` },
    qrCode: {
      // Desktop shows a QR of the raw WC uri; the Axim app scans it directly.
      getUri: (uri: string) => uri,
      // TODO: finalize store links + instruction copy before public release.
      instructions: {
        steps: [
          {
            step: "install",
            title: "Open the Axim app",
            description: "Launch the Axim app on your phone to get started.",
          },
          {
            step: "scan",
            title: "Scan the code",
            description: "Tap the scan button and point your camera at this QR code.",
          },
        ],
      },
    },
    // Store links surfaced by RainbowKit. Caller may supply real URLs; otherwise
    // TODO placeholders (bundle id com.axim.wallet). Do NOT invent store URLs.
    downloadUrls: opts.downloadUrls ?? {
      android: "TODO", // TODO: Play Store URL for com.axim.wallet
      ios: "TODO", // TODO: App Store URL for the Axim app
      qrCode: "TODO", // TODO: landing page with both store links
    },
    // The injected factory returns exactly the value RainbowKit expects for
    // `createConnector`: (walletDetails) => CreateConnectorFn.
    createConnector: opts.getWalletConnectConnector({ projectId: opts.projectId }),
  };
}
