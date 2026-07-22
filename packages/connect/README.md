# @axim-one/connect

Branded WalletConnect v2 connector + EIP‑1193 provider for **Axim Wallet**. Venue‑agnostic core.

```bash
npm install @axim-one/connect
```

`@axim-one/connect` wraps standard WalletConnect v2 (`@walletconnect/universal-provider`) and returns a standard EIP‑1193 provider. It adds a branded connection lifecycle, a RainbowKit custom‑wallet helper, `appId` attribution, and a typed error model. It takes **no hard dependency** on RainbowKit or wagmi.

## Peer dependencies

| Peer | Required when |
|---|---|
| `@walletconnect/universal-provider` | always (the transport) |
| `@rainbow-me/rainbowkit` | only if you use `aximWallet` |
| `wagmi`, `viem` | provided by your app as usual |

## API

### `createAximConnector(options): AximConnector`

Create a branded connector over WalletConnect v2.

```ts
import { createAximConnector, kaia } from "@axim-one/connect";

const connector = createAximConnector({
  projectId: WC_PROJECT_ID,  // the consuming dApp's Reown (WalletConnect Cloud) project id
  appId: "alphasec",          // attribution, carried in the WC session (sessionProperties)
  chains: [kaia],             // ChainConfig[] — optional, defaults to [kaia]
  // relayUrl: "wss://…"      // optional relay override
});
```

**`AximConnectorOptions`**

| Field | Type | Notes |
|---|---|---|
| `projectId` | `string` | The consuming dApp's [Reown](https://cloud.reown.com) (formerly WalletConnect Cloud) project id (required). The Axim wallet app uses its own separate WalletKit project id. |
| `appId` | `string` | Attribution id carried in WC `sessionProperties` |
| `chains?` | `ChainConfig[]` | Scopes the session. Defaults to `[kaia]` |
| `relayUrl?` | `string` | Override the WC relay URL |

**`AximConnector`**

| Member | Signature | Description |
|---|---|---|
| `connect` | `() => Promise<ConnectResult>` | Opens or **reuses** a persistent WC v2 session. Does not force a new pairing if one exists. |
| `resume` | `() => Promise<ConnectResult \| null>` | Restores a persisted session without pairing; `null` if none. "Connect once, stay connected." |
| `disconnect` | `() => Promise<void>` | Tears the session down. |
| `getProvider` | `() => Eip1193Provider` | Standard EIP‑1193 provider. Throws `NOT_CONNECTED` before `connect()`. |
| `getStatus` | `() => ConnectorStatus` | `"disconnected" \| "connecting" \| "connected"`. |
| `on` / `off` | `(event, handler) => void` | Subscribe/unsubscribe to connector events. |

**Events** (`AximConnectorEvents`): `connect: ConnectResult`, `disconnect: void`, `accountsChanged: Address[]`, `chainChanged: number`.

```ts
connector.on("chainChanged", (id) => console.log("chain →", id));
const { address, chainId } = await connector.connect();
const provider = connector.getProvider();
```

### `aximWallet(options): AximWalletConfig`

RainbowKit custom wallet (Path B — no public registry entry). You **inject** RainbowKit's `getWalletConnectConnector` so this package never imports RainbowKit/wagmi.

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

**`AximWalletOptions`** = `AximConnectorOptions` plus:

| Field | Type | Notes |
|---|---|---|
| `getWalletConnectConnector` | `(p: { projectId }) => unknown` | **Required.** RainbowKit's `getWalletConnectConnector`. |
| `downloadUrls?` | `{ android?, ios?, chrome?, qrCode?, … }` | Store links surfaced in the RainbowKit UI. |

The returned wallet sets `mobile.getUri` to wrap the WC URI into the Axim deep link (`https://www.axim.one/wc?uri=…`) and `qrCode.getUri` to the raw URI for desktop QR pairing.

> On the RainbowKit path the WC session is created by RainbowKit/wagmi's own WalletConnect connector, which owns `sessionProperties`; `appId` attribution there is handled by that connector. `createAximConnector` carries `appId` itself for the non‑RainbowKit path.

### Chains

```ts
import { kaia, kaiaKairos, KAIA_MAINNET_ID, KAIA_TESTNET_ID } from "@axim-one/connect";
```

`kaia` (id `8217`) and `kaiaKairos` (id `1001`, testnet) are provided as `ChainConfig` (a minimal viem‑compatible chain shape). Pass your own `ChainConfig[]` to scope the session differently.

### Errors

All SDK errors are `AximError` with a stable `code`:

```ts
import { AximError } from "@axim-one/connect";

try {
  await connector.connect();
} catch (e) {
  if (e instanceof AximError && e.code === "USER_REJECTED") { /* … */ }
}
```

Codes: `USER_REJECTED` · `TIMEOUT` · `DISCONNECTED` · `NOT_CONNECTED` · `CHAIN_NOT_SUPPORTED` · `REQUEST_FAILED` · `NOT_IMPLEMENTED`. Provider errors are mapped via `fromProviderError` (e.g. JSON‑RPC `4001` → `USER_REJECTED`).

## Status

Early release, published on npm. Implemented and typecheck‑clean; **not yet runtime‑validated** against a live relay/E2E flow — treat as preview. See the repo [README](../../README.md) and [docs.axim.one](https://docs.axim.one).

## License

[MIT](../../LICENSE) © Axim
