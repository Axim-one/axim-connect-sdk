# AlphaSec × Axim — integration guide

How AlphaSec connects to **Axim Wallet** and drives the four master‑signed touchpoints (connect → session → deposit → withdraw) using `@axim-one/connect` and `@axim-one/connect-alphasec`.

## Roles

| | Axim Wallet | AlphaSec |
|---|---|---|
| Is | USDT wallet + **master signer** + Kaia USDT rail | Kaia orderbook DEX (NitroX L2) + trading UI |
| Signs | connect, session authorization, deposit, withdraw | orders (via the session key) |
| Not | a trading venue / dApp browser | the custodian of user funds |

Transport is **WalletConnect v2**. Axim is added as a **RainbowKit custom wallet** — no WalletConnect Cloud Explorer registry entry (Path B).

## Chains & contracts

| | Mainnet | Testnet (Kairos) |
|---|---|---|
| L1 (Kaia) chainId | `8217` | `1001` |
| L2 (NitroX) chainId | `48217` | `41001` |

L2 is **gas‑free** (`gasPrice: 0`). Addresses (Inbox, L1/L2 GatewayRouter, MatchEngine `0x…cc`, ArbSys `0x…64`) are baked into `@axim-one/connect-alphasec` (`NETWORKS`). Token ids: `1 = KAIA`, `2 = USDT`.

## 1. Add Axim as a custom wallet

AlphaSec owns the RainbowKit/wagmi setup and injects `getWalletConnectConnector`:

```ts
import { aximWallet } from "@axim-one/connect";
import { connectorsForWallets, getWalletConnectConnector } from "@rainbow-me/rainbowkit";

const connectors = connectorsForWallets(
  [{ groupName: "Recommended", wallets: [
      () => aximWallet({ projectId: WC_PROJECT_ID, appId: "alphasec", getWalletConnectConnector }),
  ] }],
  { appName: "AlphaSec", projectId: WC_PROJECT_ID },
);
```

- **Mobile:** the WC pairing URI is wrapped into the Axim deep link (`https://www.axim.one/wc?uri=…`); the app opens directly to the pairing screen.
- **Desktop:** RainbowKit renders a QR of the raw WC URI; the Axim app scans it.

> The Axim app must serve `.well-known` (AASA / assetlinks) on `www.axim.one` and handle the `/wc?uri=` route for the universal link to resolve. (Wallet‑side work; tracked separately.)

## 2. Connect (no signature)

Connecting establishes a WC session only — **no signature is requested**. Proof‑of‑ownership happens once at session authorization (below), not at connect.

## 3. Authorize the trading session (one EIP‑712 signature)

```ts
import { createAximConnector } from "@axim-one/connect";
import { AlphaSecAdapter } from "@axim-one/connect-alphasec";

const connector = createAximConnector({ projectId: WC_PROJECT_ID, appId: "alphasec" });
await connector.connect();

const venue = new AlphaSecAdapter({ provider: connector.getProvider(), network: "mainnet" });
const grant = await venue.authorizeSession({ expiryDays: 30 });
// grant.sessionAddress → the L2 session wallet
// grant.sessionPrivateKey → present when the adapter generated the key (use to sign orders)
```

This is a single `eth_signTypedData_v4` (`RegisterSessionWallet`, domain `chainId = L1`) plus a gas‑free L2 tx to the MatchEngine, submitted to `POST /api/v1/wallet/session`. It is both proof‑of‑ownership and session‑key delegation. Confirm the [session‑key provenance](../packages/connect-alphasec/README.md#authorizesessionopts--sessiongrant) assumption with the Axim team.

## 4. Deposit (Kaia L1 → AlphaSec L2)

```ts
await venue.deposit("USDT", "100");
```

USDT deposit is a two‑step L1 flow (`approve` → `L1GatewayRouter.outboundTransfer`) sent through the master via `eth_sendTransaction`. Gas is paid in KAIA and may be sponsored by Axim fee delegation on the wallet side (transparent to the venue).

- The USDT L1 address is resolved at runtime (`/market/tokens`) — pass `usdtL1Address` to skip once confirmed.
- The bridge fee (`value`) defaults to `0n`; set `bridgeFeeWei` if AlphaSec requires one (see RESIDUAL‑2).

## 5. Withdraw (AlphaSec L2 → Kaia L1)

```ts
await venue.withdraw("USDT", "50");
```

The master signs a gas‑free L2 tx which is POSTed to `/api/v1/wallet/withdraw`; AlphaSec settles L1 automatically. **No fee delegation is needed for withdraw.**

## 6. Balances

```ts
const { locked, unlocked } = await venue.getVenueBalance("USDT");
```

`locked` = tied up in open orders; `unlocked` = tradable / withdrawable. This L2 view is owned by AlphaSec — read and display it, don't mirror it.

## Trading

Orders are signed by the **session key** (`grant.sessionPrivateKey` or your provided `sessionWallet`) and submitted by AlphaSec to `POST /api/v1/order`. The Axim master never signs orders.

## Testnet E2E

AlphaSec provides a testnet environment for end‑to‑end verification:

- App: `app-testnet.alphasec.trade` · Kairos (`1001`) · UI Faucet.
- Flow: desktop **Connect** → WC → QR → Axim scan → switch to Kairos → one EIP‑712 → session key auto‑signs.

Construct the adapter with `network: "testnet"` to target Kairos.

## Wallet wake (background push)

When AlphaSec issues a WC request and the Axim app is backgrounded, the relay socket may be closed. Two complementary mechanisms wake it:

1. **WC Echo push (standard):** the Axim app registers its push token with WalletConnect Echo — no AlphaSec involvement.
2. **Axim rich push (server):** an Axim‑side signal triggers `POST /internal/wc/wake`, which resolves the member and sends a rich FCM notification.

Both are Axim‑side; AlphaSec does not call Axim push APIs.

## Requirements checklist (AlphaSec side)

- [ ] WalletConnect v2 + `eth_signTypedData_v4` (EIP‑712) support (RainbowKit ≥ 2 covers this).
- [ ] Add Axim via `aximWallet(...)` with injected `getWalletConnectConnector`.
- [ ] No WalletConnect Cloud Explorer registry entry required (Path B).
- [ ] Confirm the session‑key provenance and the three residuals with the Axim team before production.
