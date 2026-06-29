import type { Address } from "@axim/connect";

export type Network = "mainnet" | "testnet";

/** On-chain addresses + chain ids per network. Source: docs.alphasec.trade. */
export const NETWORKS = {
  mainnet: {
    l1ChainId: 8217,
    l2ChainId: 48217,
    l2Rpc: "https://l2-sequencer.alphasec.trade",
    l1: {
      inbox: "0xe4CD7C744C8016a8E42336c91366fB78a192F426" as Address,
      gatewayRouter: "0x35Be945fb1da550a76f1FAD6D3759437d71bA739" as Address,
      bridge: "0xF31CE581A8440f0f4850eDEb343a28372572a088" as Address,
    },
    l2: {
      matchEngine: "0x00000000000000000000000000000000000000cc" as Address,
      arbSys: "0x0000000000000000000000000000000000000064" as Address,
      gatewayRouter: "0x9e0648ec6Cd742ccb5EE9f9b3120eaEF014A684d" as Address,
    },
  },
  testnet: {
    l1ChainId: 1001,
    l2ChainId: 41001,
    l2Rpc: "https://l2-sequencer-testnet.alphasec.trade",
    l1: {
      inbox: "0xF6B3519a72989BC5d6591b25F47656585a8deF60" as Address,
      gatewayRouter: "0x74F972A16a9B902f4B3A2b9546f5a77d98DA1070" as Address,
      bridge: "0xF723f6AD011d2996255991e3E442311d22DD6D42" as Address,
    },
    l2: {
      matchEngine: "0x00000000000000000000000000000000000000cc" as Address,
      arbSys: "0x0000000000000000000000000000000000000064" as Address,
      gatewayRouter: "0x097209B15FB6cEefba90EA10e4c1c5439E6bC1Ea" as Address,
    },
  },
} as const;

/** Numeric token ids used by the venue. `l1Address` resolved at runtime via GET /market/tokens. */
export const TOKENS = {
  KAIA: { id: 1, decimals: 18 },
  USDT: { id: 2, decimals: 6 },
} as const;

/** EIP-712 domain for session-key authorization (RegisterSessionWallet). chainId = L1. */
export const sessionDomain = (network: Network) => ({
  name: "DEXSignTransaction",
  version: "1",
  chainId: NETWORKS[network].l1ChainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
});

/** DEX command bytes (prefix of L2 tx calldata to MatchEngine). */
export const DEX_COMMAND = { session: 0x01 } as const;

/** Default REST API base. Override via adapter options. */
export const API_BASE: Record<Network, string> = {
  mainnet: "https://api.alphasec.trade", // TODO: confirm REST host
  testnet: "https://api-testnet.alphasec.trade", // TODO: confirm REST host
};
