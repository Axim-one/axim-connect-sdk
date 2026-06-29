/** Minimal viem-compatible chain shape (no hard dependency on viem). */
export interface ChainConfig {
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[] } };
  blockExplorers?: { default: { name: string; url: string } };
  testnet?: boolean;
}

export const KAIA_MAINNET_ID = 8217;
export const KAIA_TESTNET_ID = 1001;

export const kaia: ChainConfig = {
  id: KAIA_MAINNET_ID,
  name: "Kaia",
  nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  rpcUrls: { default: { http: ["https://public-en.node.kaia.io"] } },
  blockExplorers: { default: { name: "Kaiascan", url: "https://kaiascan.io" } },
};

export const kaiaKairos: ChainConfig = {
  id: KAIA_TESTNET_ID,
  name: "Kaia Kairos Testnet",
  nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  rpcUrls: { default: { http: ["https://public-en-kairos.node.kaia.io"] } },
  blockExplorers: { default: { name: "Kaiascan (Kairos)", url: "https://kairos.kaiascan.io" } },
  testnet: true,
};
