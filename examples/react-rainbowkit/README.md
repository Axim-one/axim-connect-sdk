# Runnable example — AlphaSec × Axim (React + RainbowKit + wagmi)

A **real** integration example: this app imports and calls `@axim-one/connect` and
`@axim-one/connect-alphasec` directly — it does not simulate them.

- `src/wagmi.ts` — registers Axim as a RainbowKit custom wallet via `aximWallet(...)`
  (injecting RainbowKit's `getWalletConnectConnector`), scoped to Kaia / Kairos.
- `src/App.tsx` — a mini trading dApp UI. After connecting, builds a real
  `AlphaSecAdapter` from the connected wallet's EIP‑1193 provider and drives the
  full surface: `authorizeSession` / `revokeSession` / `deposit` / `withdraw` /
  `getVenueBalance`, with a session-status card, balance card, and deposit/withdraw
  forms. Every call is the actual SDK; results and errors are shown in the log.
- `src/mockFetch.ts` — **Mock mode** (on by default). Replaces only AlphaSec's REST
  responses (session create/delete, withdraw submit, balance, market tokens) with
  local stubs, so the whole flow completes without a live AlphaSec backend. The
  wallet still signs for real — every approval screen is exercised end‑to‑end.
  Deposit's on-chain broadcast is *not* mocked (it goes to the Axim relayer, our
  infra, not AlphaSec).

## Run

```bash
# from the repo root, build the workspace packages once:
npm install
npm run build

# then the example (it links the packages via file: deps):
cd examples/react-rainbowkit
npm install
echo "VITE_WC_PROJECT_ID=<your Reown (WalletConnect Cloud) project id>" > .env
npm run dev
```

Open the printed URL, click **Connect with Axim** → this is a genuine
WalletConnect v2 pairing (QR on desktop, deep link on mobile).

## What actually works vs. what needs a live setup

- **Connect / pairing:** fully real — produces a real WC URI + QR from `@axim-one/connect`.
  Needs a real `VITE_WC_PROJECT_ID` (Mock mode does **not** remove this — it only
  replaces AlphaSec REST, not the WC transport).
- **Mock mode ON (default):** session authorize/revoke, withdraw, and balance
  **complete end‑to‑end** against a real Axim wallet — you see and approve every
  signing screen, and the AlphaSec REST leg is served locally. This is the intended
  way to validate the wallet + SDK + approval UX **before** AlphaSec is wired.
- **Mock mode OFF (live):** the same SDK calls submit to AlphaSec's Kairos testnet
  REST (`network: "testnet"`, `app-testnet.alphasec.trade`, UI Faucet); completing
  them needs AlphaSec's backend live.
- **Deposit (type49):** signs + broadcasts through the Axim relayer's
  `/fee-delegation` (our infra) — needs a funded Kaia fee‑payer on stage. Not
  AlphaSec-owned, so Mock mode doesn't touch it.

## Deploy (for mobile QR / deep‑link + wake testing)

```bash
npm run build:bundle   # → dist/ (static site)
# host dist/ on any static host; set VITE_WC_PROJECT_ID at build time.
```

A hosted URL lets you scan the QR / follow the deep link from a phone so the Axim
app pairs and (with Reown Push configured) wakes on requests. Pairing requires the
real dApp-side `VITE_WC_PROJECT_ID`.

## Build / typecheck

```bash
npm run build       # tsc --noEmit — typechecks the app against the real SDK
npm run build:bundle  # vite production bundle
```

> In *this monorepo*, `@axim-one/connect` is linked via `file:` deps, so a production
> `vite build` can hit a transitive WalletConnect crypto resolution edge
> (`@scure/bip32` → `@noble/curves`) caused by cross-`node_modules` hoisting. It
> does **not** affect `npm run dev` or a consumer who installs `@axim-one/connect`
> from a registry (their dependency tree is consistent). Use `npm run dev` to run.

## Notes

- `VITE_WC_PROJECT_ID` is a **dApp-side** [Reown](https://cloud.reown.com) (formerly WalletConnect Cloud) project id — this example plays the dApp (AlphaSec) role, so it uses the dApp's project id. Note: the **Axim wallet app** initializes its own WalletKit with a **separate, Axim-owned** project id — a different value from this one.
- `aximWallet(...)` returns `@axim-one/connect`'s `AximWalletConfig`, cast to RainbowKit's
  `Wallet` in `wagmi.ts` (the SDK models `createConnector` as `unknown` to avoid a hard
  RainbowKit/wagmi dependency; at runtime it is exactly what RainbowKit expects).
- To target mainnet, change `network: "testnet"` → `"mainnet"` in `App.tsx`.
