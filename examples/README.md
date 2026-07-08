# Examples

Two examples, for two purposes.

## `react-rainbowkit/` — runnable app that **uses the SDK** (recommended)

A real React + wagmi + RainbowKit app that **imports and calls** `@axim-one/connect`
and `@axim-one/connect-alphasec` — not a simulation.

- `src/wagmi.ts` registers Axim via `aximWallet(...)`; `src/App.tsx` drives a real
  `AlphaSecAdapter` (`authorizeSession` / `deposit` / `withdraw` / `getVenueBalance`)
  from the connected wallet's EIP‑1193 provider.
- **Connect / pairing is genuinely real** (WalletConnect v2 QR + deep link). The venue
  actions really invoke the SDK; they *complete* only against a live Axim wallet + the
  AlphaSec Kairos testnet.
- Run: `npm install && npm run dev` (needs `VITE_WC_PROJECT_ID`). See its [README](./react-rainbowkit/README.md).

## `sample-page/` — zero‑install visual walkthrough (single‑file HTML)

An interactive, self‑contained **simulation** of the flow (connect → session → deposit
→ withdraw) shown from both the dApp and Axim wallet sides, with a real scannable QR and
the actual SDK code as copyable snippets.

- **Open:** double‑click `sample-page/index.html` (no build, no dependencies).
- **Note:** the wallet, addresses, balances, and tx hashes are mocked — it visualizes the
  flow. For code that actually runs the SDK, use `react-rainbowkit/` above.

---

For the full, non‑simulated integration steps, see [`../docs/integration-alphasec.md`](../docs/integration-alphasec.md).
