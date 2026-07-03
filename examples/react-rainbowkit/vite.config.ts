import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SDK is linked via `file:` in this monorepo. Its transitive WalletConnect /
// crypto deps (@scure, @noble) must resolve to a single copy from THIS app's
// node_modules — otherwise a symlinked package resolves them from the SDK root
// and Rollup/esbuild can't find subpaths like `@noble/curves/abstract/modular`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "viem",
      "wagmi",
      "@walletconnect/universal-provider",
      "@walletconnect/core",
      "@walletconnect/utils",
      "@noble/curves",
      "@noble/hashes",
      "@scure/bip32",
      "@scure/bip39",
    ],
  },
  optimizeDeps: {
    include: ["@axim/connect", "@axim/connect-alphasec"],
  },
});
