import type { TokenRef } from "@axim/connect";
import { TOKENS } from "./contracts.js";

export interface ResolvedToken {
  id: number;
  symbol: "KAIA" | "USDT";
  decimals: number;
}

const BY_SYMBOL = TOKENS as Record<"KAIA" | "USDT", { id: number; decimals: number }>;

/** Resolve a TokenRef (symbol or numeric id) to its id/symbol/decimals. */
export function resolveToken(token: TokenRef): ResolvedToken {
  if (typeof token === "number") {
    for (const symbol of ["KAIA", "USDT"] as const) {
      const v = BY_SYMBOL[symbol];
      if (v.id === token) return { id: v.id, symbol, decimals: v.decimals };
    }
    throw new Error(`Unknown token id: ${token}`);
  }
  const v = BY_SYMBOL[token];
  return { id: v.id, symbol: token, decimals: v.decimals };
}

/** Human amount → base units. parseAmount("USDT", "1.5") => 1500000n */
export function parseAmount(token: TokenRef, human: string): bigint {
  const { decimals } = resolveToken(token);
  const parts = human.trim().split(".");
  const whole = (parts[0] ?? "0").replace(/\D/g, "") || "0";
  const fracRaw = (parts[1] ?? "").replace(/\D/g, "");
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(`${whole}${frac}`);
}

/** Base units → human string. formatAmount("USDT", 1500000n) => "1.5" */
export function formatAmount(token: TokenRef, base: bigint | string): string {
  const { decimals } = resolveToken(token);
  const v = (typeof base === "string" ? BigInt(base) : base).toString().padStart(decimals + 1, "0");
  const whole = v.slice(0, v.length - decimals);
  const frac = v.slice(v.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
