export * from "./types.js";
export { aximWallet } from "./rainbowkit.js";

import type { AximConnector, AximConnectorOptions, Eip1193Provider } from "./types.js";

const DEFAULT_CHAINS = [8217]; // Kaia mainnet

/**
 * Create a branded Axim connector over WalletConnect v2.
 * Returns a standard EIP-1193 provider via `getProvider()`.
 *
 * Preview: transport wiring (WalletConnect UniversalProvider) is not yet
 * implemented. The shape is frozen against the SDK spec.
 */
export function createAximConnector(opts: AximConnectorOptions): AximConnector {
  const chains = opts.chains ?? DEFAULT_CHAINS;
  void chains;
  void opts.appId; // carried into WC session metadata for attribution
  let provider: Eip1193Provider | undefined;

  return {
    getProvider(): Eip1193Provider {
      if (!provider) {
        // TODO: wrap @walletconnect/universal-provider, scope to `chains`,
        // inject `appId` into session metadata, expose as EIP-1193.
        throw new Error(
          "@axim/connect: WalletConnect provider not yet implemented (preview)."
        );
      }
      return provider;
    },
    async disconnect(): Promise<void> {
      // TODO: close the WalletConnect session.
    },
  };
}
