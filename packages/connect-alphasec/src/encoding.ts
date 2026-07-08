import { AximError, type Address, type Eip1193Provider } from "@axim-one/connect";
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  numberToHex,
} from "viem";
import { L1_GATEWAY_ROUTER_ABI } from "./contracts.js";

/**
 * RUNTIME-UNTESTED encoding/provider helpers shared by the AlphaSec adapter.
 * All tx encoding goes through viem; nothing here has been exercised against a
 * live Kaia L1/L2 node or the AlphaSec REST API.
 */

/** bigint | number -> `0x`-prefixed hex quantity (EIP-1193 shape). */
export function toHex(value: bigint | number): `0x${string}` {
  return numberToHex(typeof value === "bigint" ? value : BigInt(value));
}

/** UTF-8 string -> `0x`-prefixed hex (used for L2 SessionContext calldata). */
export function utf8ToHex(text: string): `0x${string}` {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return `0x${out}`;
}

/** Concatenate hex fragments (each `0x...`) into one `0x...` string. */
export function concatHex(...parts: `0x${string}`[]): `0x${string}` {
  return `0x${parts.map((p) => p.slice(2)).join("")}`;
}

/**
 * L1 outboundTransfer `extraData` = abi.encode(uint256 bridgeFee, bytes "0x").
 */
export function encodeBridgeExtraData(bridgeFeeWei: bigint): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes" }],
    [bridgeFeeWei, "0x"],
  );
}

/**
 * Resolve the ERC20 gateway (= approve spender) for an L1 token via
 * `L1GatewayRouter.getGateway(token)` over `eth_call`.
 */
export async function getGateway(
  provider: Eip1193Provider,
  router: Address,
  l1Token: Address,
): Promise<Address> {
  const data = encodeFunctionData({
    abi: L1_GATEWAY_ROUTER_ABI,
    functionName: "getGateway",
    args: [getAddress(l1Token)],
  });
  const raw = await provider.request<`0x${string}`>({
    method: "eth_call",
    params: [{ to: router, data }, "latest"],
  });
  const gateway = decodeFunctionResult({
    abi: L1_GATEWAY_ROUTER_ABI,
    functionName: "getGateway",
    data: raw,
  });
  if (
    typeof gateway !== "string" ||
    /^0x0{40}$/i.test(gateway)
  ) {
    throw new AximError(
      "REQUEST_FAILED",
      `L1GatewayRouter.getGateway returned no gateway for token ${l1Token}`,
    );
  }
  return getAddress(gateway);
}
