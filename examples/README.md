# Examples

## `sample-page/` — AlphaSec 연동 샘플 (single-file HTML)

An interactive, self-contained demo of the Axim × AlphaSec integration flow — connect → session authorization → deposit → withdraw — shown from both the dApp and the Axim wallet side.

- **Open:** double‑click `sample-page/index.html` (no build, no dependencies).
- **What it shows:** the four master‑signed touchpoints, a WalletConnect‑style pairing/QR, per‑touchpoint approval sheets, an event log, and the real `@axim/connect` / `@axim/connect-alphasec` code for each path (RainbowKit, vanilla EIP‑1193, adapter).
- **Note:** this is a **front‑end simulation** — the wallet, addresses, balances, and tx hashes are mocked. In a real integration, `@axim/connect` pairs with the Axim app over WalletConnect v2 and the approval sheets render in the actual app.

For the full, non‑simulated integration steps, see [`../docs/integration-alphasec.md`](../docs/integration-alphasec.md).
