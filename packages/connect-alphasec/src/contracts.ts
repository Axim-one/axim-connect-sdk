import type { Address } from "@axim/connect";
import { parseAbi } from "viem";

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

/** REST API base. Confirmed: docs.alphasec.trade/for-developers/api. Override via adapter options. */
export const API_BASE: Record<Network, string> = {
  mainnet: "https://api.alphasec.trade",
  testnet: "https://api-testnet.alphasec.trade",
};

/** Session-wallet REST endpoints (create vs update vs delete — distinct subpaths). */
export const SESSION_ENDPOINTS = {
  create: "/api/v1/wallet/session",
  update: "/api/v1/wallet/session/update",
  delete: "/api/v1/wallet/session/delete",
} as const;

/**
 * Default ERC20 deposit bridge fee (L2 execution + submission cost), sent as the
 * L1 outboundTransfer `value` AND inside extraData. Confirmed 0.01 KAIA (1e16 wei)
 * per docs.alphasec.trade/for-developers/bridge. Override via `bridgeFeeWei`.
 */
export const BRIDGE_FEE_DEFAULT_WEI = 10_000_000_000_000_000n;

/**
 * Confirmed Kaia L1 USDT contract address per network. Mainnet confirmed by Axim.
 * (⚠️ `/market/tokens` returns Ethereum's USDT `0xdAC17…` as a placeholder — do NOT
 * use that for the Kaia L1 deposit token.) Testnet address TBD → runtime lookup.
 */
export const USDT_L1: Record<Network, Address | null> = {
  mainnet: "0xd077A400968890Eacc75cdc901F0356c943e4fDb" as Address,
  testnet: null,
};

/* -------------------------------------------------------------------------- */
/* Minimal ABIs (viem parseAbi). Only the fns we encode/decode.               */
/* -------------------------------------------------------------------------- */

/** ERC20 approve on the L1 token contract. */
export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/**
 * L1 GatewayRouter. `getGateway` resolves the per-token ERC20 gateway
 * (= the approve spender). `outboundTransfer` bridges L1 -> L2.
 */
export const L1_GATEWAY_ROUTER_ABI = parseAbi([
  "function getGateway(address token) view returns (address gateway)",
  "function outboundTransfer(address l1Token, address to, uint256 amount, uint256 maxGas, uint256 gasPriceBid, bytes extraData) payable returns (bytes)",
]);

/**
 * L2 GatewayRouter variant: 4 args with a trailing empty bytes. Used by
 * withdraw (L2 -> L1). Distinct from the L1 6-arg form above.
 */
export const L2_GATEWAY_ROUTER_ABI = parseAbi([
  "function outboundTransfer(address l1Token, address to, uint256 amount, bytes data) payable returns (bytes)",
]);

/** L1 Inbox: native KAIA deposit. */
export const INBOX_ABI = parseAbi(["function depositEth() payable returns (uint256)"]);

/** L2 ArbSys precompile: native KAIA withdraw to L1. */
export const ARBSYS_ABI = parseAbi([
  "function withdrawEth(address destination) payable returns (uint256)",
]);

/**
 * Function selectors we assert against the ground-truth reference. viem derives
 * the same selectors from the ABIs above; kept here for cross-checking.
 *   Inbox.depositEth()            = 0x439370b1
 *   ArbSys.withdrawEth(address)   = 0x25e16063
 */
export const SELECTOR = {
  depositEth: "0x439370b1",
  withdrawEth: "0x25e16063",
} as const;

/** Default large gas limit for gas-free L2 txs (0x30000). */
export const L2_DEFAULT_GAS = 0x30000n;

/** Bridge params for L1 outboundTransfer. */
export const BRIDGE_MAX_GAS = 1_000_000n;
export const BRIDGE_GAS_PRICE_BID = 1_000_000_000n; // 1 gwei
