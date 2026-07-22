# @axim-one/connect

> Connect dApps to **Axim Wallet** over WalletConnect v2. A thin, branded EIP‑1193 connector — works unchanged with ethers, viem, and wagmi.

[![status](https://img.shields.io/badge/status-alpha-blue)](https://docs.axim.one) [![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Axim is a USDT‑first wallet on Kaia. `@axim-one/connect` is **not a new protocol** — it is a thin wrapper over standard WalletConnect v2 that returns a standard EIP‑1193 provider, plus a small adapter layer that isolates venue‑specific flows (e.g. AlphaSec deposit/withdraw/session). If your app already supports WalletConnect, adding Axim is close to zero work.

## Packages

| Package | Description |
|---|---|
| [`@axim-one/connect`](./packages/connect) | **Published.** Vendor‑agnostic core: branded connector, EIP‑1193 provider, RainbowKit custom wallet, `appId` attribution. |
| [`@axim-one/connect-alphasec`](./packages/connect-alphasec) | **Published.** AlphaSec venue adapter (`authorizeSession`, `deposit`, `withdraw`, `getVenueBalance`). |

## Install

```bash
npm install @axim-one/connect
```

> Both packages are published to npm. `@axim-one/connect` is the venue‑agnostic core; installing `@axim-one/connect-alphasec` pulls it in automatically.

Peer dependencies (provide the ones your app uses): `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `@walletconnect/universal-provider`. `@axim-one/connect` takes **no hard dependency** on RainbowKit or wagmi — the RainbowKit connector factory is injected (see below).

## Two ways to integrate

### 1. RainbowKit custom wallet (recommended for wagmi/RainbowKit apps)

Axim is added as a **custom wallet** — no WalletConnect Cloud Explorer registry entry is required. You inject RainbowKit's `getWalletConnectConnector` so `@axim-one/connect` never has to depend on RainbowKit/wagmi directly.

```ts
import { aximWallet } from "@axim-one/connect";
import { connectorsForWallets, getWalletConnectConnector } from "@rainbow-me/rainbowkit";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        () => aximWallet({ projectId: WC_PROJECT_ID, appId: "alphasec", getWalletConnectConnector }),
      ],
    },
  ],
  { appName: "AlphaSec", projectId: WC_PROJECT_ID },
);
```

On mobile, RainbowKit hands the raw WalletConnect pairing URI to Axim's `mobile.getUri`, which wraps it into the Axim deep link (`https://www.axim.one/wc?uri=…`) so the app opens straight to the pairing screen. On desktop, RainbowKit renders a QR of the raw URI for the Axim app to scan.

### 2. Vanilla EIP‑1193 (non‑RainbowKit apps)

```ts
import { createAximConnector, kaia } from "@axim-one/connect";

const connector = createAximConnector({
  projectId: WC_PROJECT_ID,
  appId: "alphasec",
  chains: [kaia], // ChainConfig[] — defaults to [kaia]
});

const result = await connector.connect();        // opens/resumes a WC v2 session
const provider = connector.getProvider();          // standard EIP‑1193 — use with ethers / viem
const [address] = await provider.request({ method: "eth_accounts" });
```

### Venue adapter (AlphaSec)

```ts
import { AlphaSecAdapter } from "@axim-one/connect-alphasec";

const venue = new AlphaSecAdapter({ provider, network: "mainnet" });
const grant = await venue.authorizeSession({ expiryDays: 30 }); // EIP‑712 session‑key authorization (once)
await venue.deposit("USDT", "100");                              // Kaia L1 → AlphaSec L2
await venue.withdraw("USDT", "50");                             // AlphaSec L2 → Kaia L1
const bal = await venue.getVenueBalance("USDT");                // { locked, unlocked }
```

See the [AlphaSec integration guide](./docs/integration-alphasec.md) for the full end‑to‑end flow.

## Design

- **Transport is WalletConnect v2.** No custom wire. Standard EIP‑1193 surface.
- **The wallet wakes only when it matters** — connect, session authorization, deposit, withdraw. Trading runs on the venue session key and never round‑trips to the wallet.
- **Scoped by design.** Axim connects to specific partner venues; it is not a general dApp browser.

## Status

**Early release, published on npm.** The API surface is implemented and typecheck‑clean, but has **not yet been exercised against a live WalletConnect relay or an end‑to‑end pairing/deposit/withdraw flow** — treat as runtime‑untested until the Kaia Kairos testnet E2E completes. See the spec and docs at [docs.axim.one](https://docs.axim.one).

## Development

```bash
npm install      # installs workspace deps (Node ≥ 22 recommended)
npm run build    # builds all packages
npm run typecheck
```

## License

[MIT](./LICENSE) © Axim
