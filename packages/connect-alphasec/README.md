# @axim-one/connect-alphasec

AlphaSec venue adapter for [`@axim-one/connect`](../connect). Isolates all AlphaSec‑specific signing and submission behind the venue‑agnostic `VenueAdapter` interface.

```bash
npm install @axim-one/connect-alphasec
```

Pulls in `@axim-one/connect` and `viem` automatically.

## Position

Axim is the **master signer** and USDT rail. It signs exactly four touchpoints — connect, session authorization, deposit, withdraw. Trading (order signing) runs on AlphaSec's session key and never round‑trips to the wallet. AlphaSec = Kaia orderbook DEX on the NitroX (Arbitrum‑Nitro) L2 rollup; L1 = Kaia (`8217` / testnet `1001`), L2 = `48217` / `41001`.

## Usage

```ts
import { createAximConnector } from "@axim-one/connect";
import { AlphaSecAdapter } from "@axim-one/connect-alphasec";

const connector = createAximConnector({ projectId, appId: "alphasec" });
await connector.connect();

const venue = new AlphaSecAdapter({ provider: connector.getProvider(), network: "mainnet" });
```

### `AlphaSecAdapterOptions`

| Field | Type | Notes |
|---|---|---|
| `provider` | `Eip1193Provider` | The master signer (Axim over WalletConnect). |
| `network?` | `"mainnet" \| "testnet"` | Defaults to `"mainnet"`. Testnet = Kairos (`1001`). |
| `apiBase?` | `string` | Override the AlphaSec REST base. |
| `usdtL1Address?` | `Address` | Skip the runtime `/market/tokens` lookup for USDT's Kaia L1 address (see RESIDUAL‑1). |
| `bridgeFeeWei?` | `bigint` | Deposit bridge fee (KAIA wei). Defaults to `0n` (see RESIDUAL‑2). |

## Methods (`VenueAdapter`)

### `authorizeSession(opts?) → SessionGrant`

Authorizes an L2 session wallet: a one‑time master EIP‑712 signature (`RegisterSessionWallet`, domain `chainId = L1`) plus a gas‑free L2 tx to the MatchEngine (`command 0x01`), submitted to `POST /api/v1/wallet/session`.

```ts
const grant = await venue.authorizeSession({ expiryDays: 30 });
// grant: { sessionAddress, expiry, applied, sessionPrivateKey? }
```

`opts`: `{ expiryDays?, name?, sessionWallet? }`.

> **Session‑key provenance (confirm with AlphaSec).** If you do not pass `sessionWallet`, the adapter **generates** the session keypair and returns its private key on `grant.sessionPrivateKey` so your app can sign orders with it — the master key never signs orders. If AlphaSec expects the session key to originate on their side, pass `sessionWallet` instead.

### `deposit(token, amount) → TxResult`

Bridges Kaia **L1 → L2** via direct on‑chain L1 txs (no REST). Gas is paid in KAIA by the master (the Axim wallet may fee‑delegate — not the adapter's concern).

- **USDT (ERC20):** `approve(gateway, amount)` then `L1GatewayRouter.outboundTransfer(...)`. The approve spender is resolved at runtime via `L1GatewayRouter.getGateway(l1Token)`; the USDT L1 address is resolved via `GET /api/v1/market/tokens` (RESIDUAL‑1).
- **KAIA (native):** `Inbox.depositEth()` with `value = amount`.

Returns the `outboundTransfer` (or `depositEth`) tx hash.

### `withdraw(token, amount, to?) → TxResult`

Withdraws **L2 → L1**. The master signs a **gas‑free L2 tx** (`gasPrice 0`) which is submitted to `POST /api/v1/wallet/withdraw`; AlphaSec settles L1 automatically (no L1 gas, no fee delegation).

- **USDT:** `L2GatewayRouter.outboundTransfer(l1Token, l1Recipient, amount, "0x")`.
- **KAIA:** `ArbSys.withdrawEth(destination)` with `value = amount`.

`to` defaults to the master address.

### `getVenueBalance(token) → Balance`

Reads the L2 balance via `GET /api/v1/wallet/balance`. Returns `{ token, locked, unlocked }` (locked = tied up in open orders).

## Helpers

`resolveToken`, `parseAmount`, `formatAmount` (units), plus `NETWORKS`, `TOKENS`, `sessionDomain`, `DEX_COMMAND`, `API_BASE`, and the minimal contract ABIs are exported for advanced use.

```ts
import { parseAmount, formatAmount } from "@axim-one/connect-alphasec";
parseAmount("USDT", "1.5"); // 1500000n
formatAmount("USDT", 1500000n); // "1.5"
```

## Residuals (confirm with AlphaSec before production)

- **RESIDUAL‑1 — USDT L1 address.** AlphaSec docs ship a placeholder; the adapter resolves the real Kaia L1 USDT address at runtime from `/api/v1/market/tokens`. Pass `usdtL1Address` to skip the lookup once confirmed.
- **RESIDUAL‑2 — deposit bridge fee.** `bridgeFeeWei` defaults to `0n`; the adapter never fabricates a nonzero fee. True gasless deposit requires a sponsor policy on the Axim side.
- **REST host / response shapes** (`/wallet/session`, `/wallet/withdraw`, `/market/tokens`) are modeled defensively and are **runtime‑untested** — verify against the live API and the Kairos testnet.

## Status

Early release, published on npm. **Not yet runtime‑validated** against live Kaia L1/L2 + AlphaSec REST (E2E) — treat as preview. See the [AlphaSec integration guide](../../docs/integration-alphasec.md).

## License

[MIT](../../LICENSE) © Axim
