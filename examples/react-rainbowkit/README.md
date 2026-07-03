# Runnable example — AlphaSec × Axim (React + RainbowKit + wagmi)

A **real** integration example: this app imports and calls `@axim/connect` and
`@axim/connect-alphasec` directly — it does not simulate them.

- `src/wagmi.ts` — registers Axim as a RainbowKit custom wallet via `aximWallet(...)`
  (injecting RainbowKit's `getWalletConnectConnector`), scoped to Kaia / Kairos.
- `src/App.tsx` — after connecting, builds a real `AlphaSecAdapter` from the
  connected wallet's EIP‑1193 provider and calls `authorizeSession` / `deposit` /
  `withdraw` / `getVenueBalance`. Every call is the actual SDK; results and errors
  are shown in the log.

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

- **Connect / pairing:** fully real — produces a real WC URI + QR from `@axim/connect`.
- **Session / deposit / withdraw / balance:** the SDK calls are real, but they only
  *complete* against a live **Axim wallet** approving the requests and the AlphaSec
  **Kairos testnet** (`network: "testnet"`, `app-testnet.alphasec.trade`, UI Faucet).
  Without those, the buttons will surface a pending/rejected/error result in the log —
  which is the honest behavior.

## Build / typecheck

```bash
npm run build       # tsc --noEmit — typechecks the app against the real SDK
npm run build:bundle  # vite production bundle
```

> In *this monorepo*, `@axim/connect` is linked via `file:` deps, so a production
> `vite build` can hit a transitive WalletConnect crypto resolution edge
> (`@scure/bip32` → `@noble/curves`) caused by cross-`node_modules` hoisting. It
> does **not** affect `npm run dev` or a consumer who installs `@axim/connect`
> from a registry (their dependency tree is consistent). Use `npm run dev` to run.

## Notes

- `VITE_WC_PROJECT_ID` is a **dApp-side** [Reown](https://cloud.reown.com) (formerly WalletConnect Cloud) project id — this example plays the dApp (AlphaSec) role, so it uses the dApp's project id. Note: the **Axim wallet app** initializes its own WalletKit with a **separate, Axim-owned** project id — a different value from this one.
- `aximWallet(...)` returns `@axim/connect`'s `AximWalletConfig`, cast to RainbowKit's
  `Wallet` in `wagmi.ts` (the SDK models `createConnector` as `unknown` to avoid a hard
  RainbowKit/wagmi dependency; at runtime it is exactly what RainbowKit expects).
- To target mainnet, change `network: "testnet"` → `"mainnet"` in `App.tsx`.
