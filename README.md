# @axim/connect

> Connect dApps to **Axim Wallet** over WalletConnect v2. A thin, branded EIP‑1193 connector — works unchanged with ethers, viem, and wagmi.

[![status](https://img.shields.io/badge/status-preview-blue)](https://docs.axim.one) [![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Axim is a USDT‑first wallet on Kaia. `@axim/connect` is **not a new protocol** — it's a thin wrapper over standard WalletConnect v2 that returns a standard EIP‑1193 provider, plus a small adapter layer that isolates venue‑specific flows (e.g. AlphaSec deposit/withdraw/session). If your app already supports WalletConnect, adding Axim is close to zero work.

## Packages

| Package | Description |
|---|---|
| [`@axim/connect`](./packages/connect) | **Published.** Vendor‑agnostic core: branded connector, EIP‑1193 provider, RainbowKit custom wallet, `appId` attribution. |
| [`@axim/connect-alphasec`](./packages/connect-alphasec) | **In‑repo, not published.** AlphaSec venue adapter (`authorizeSession`, `deposit`, `withdraw`, `getVenueBalance`). Consumed from this monorepo by the venue. |

## Install

```bash
npm install @axim/connect
```

> Only `@axim/connect` is published to npm. Venue adapters (e.g. the AlphaSec adapter) live in this monorepo and are consumed by the venue directly — the public package stays venue‑agnostic.

Peer dependencies (provide the ones your app uses): `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `@walletconnect/universal-provider`.

## Quickstart

### RainbowKit (custom wallet — no public registry required)

```ts
import { aximWallet } from "@axim/connect";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";

const connectors = connectorsForWallets(
  [{ groupName: "Recommended", wallets: [aximWallet({ projectId: WC_PROJECT_ID, appId: "alphasec" })] }],
  { appName: "AlphaSec", projectId: WC_PROJECT_ID }
);
```

### Vanilla EIP‑1193

```ts
import { createAximConnector } from "@axim/connect";

const connector = createAximConnector({ projectId: WC_PROJECT_ID, appId: "alphasec", chains: [8217] });
const provider = connector.getProvider(); // EIP‑1193 — use with ethers / viem
const [address] = await provider.request({ method: "eth_requestAccounts" });
```

### Venue adapter (AlphaSec)

```ts
import { AlphaSecAdapter } from "@axim/connect-alphasec";

const venue = new AlphaSecAdapter({ provider, network: "mainnet" });
await venue.authorizeSession({ expiryDays: 30 }); // EIP‑712 session‑key authorization (once)
await venue.deposit("USDT", "100");               // Kaia L1 → AlphaSec L2
await venue.withdraw("USDT", "50");               // AlphaSec L2 → Kaia L1
const bal = await venue.getVenueBalance("USDT");  // { locked, unlocked }
```

## Design

- **Transport is WalletConnect v2.** No custom wire. Standard EIP‑1193 surface.
- **The wallet wakes only when it matters** — connect, session authorization, deposit, withdraw. Trading runs on the venue session key and never round‑trips to the wallet.
- **Scoped by design.** Axim connects to specific partner venues; it is not a general dApp browser.

> **Preview.** APIs are stabilizing. See the spec and docs at [docs.axim.one](https://docs.axim.one).

## Development

```bash
npm install      # installs workspace deps
npm run build    # builds all packages
```

## License

[MIT](./LICENSE) © Axim
