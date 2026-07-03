import { useCallback, useState, type CSSProperties } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { AlphaSecAdapter } from "@axim/connect-alphasec";
import type { Eip1193Provider } from "@axim/connect";
import { isConfigured } from "./wagmi";

type LogKind = "run" | "ok" | "err";
interface LogLine {
  kind: LogKind;
  text: string;
  t: string;
}

export function App() {
  const { connector, address, isConnected, chainId } = useAccount();
  const [log, setLog] = useState<LogLine[]>([]);

  const push = useCallback((kind: LogKind, text: string) => {
    const t = new Date().toLocaleTimeString("en-GB");
    setLog((l) => [{ kind, text, t }, ...l].slice(0, 60));
  }, []);

  // Build a real AlphaSecAdapter from the connected wallet's EIP-1193 provider.
  const getVenue = useCallback(async (): Promise<AlphaSecAdapter> => {
    if (!connector) throw new Error("지갑이 연결되지 않았습니다.");
    const provider = (await connector.getProvider()) as Eip1193Provider;
    return new AlphaSecAdapter({ provider, network: "testnet" });
  }, [connector]);

  // Wrap a real SDK call: log start, result, or error (code + message).
  const run = (label: string, fn: (v: AlphaSecAdapter) => Promise<unknown>) => async () => {
    push("run", `▶ ${label} …`);
    try {
      const venue = await getVenue();
      const result = await fn(venue);
      push("ok", `✓ ${label} → ${JSON.stringify(result)}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      push("err", `✗ ${label} → ${[err.code, err.message].filter(Boolean).join(" ") || String(e)}`);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div style={S.logo}>◆</div>
          <div>
            <h1 style={S.h1}>
              AlphaSec × Axim — <code style={S.code}>@axim/connect</code> live example
            </h1>
            <p style={S.sub}>
              이 앱은 <b>실제 SDK</b>를 import·호출합니다. “Connect with Axim”은 진짜 WalletConnect v2
              페어링(QR/딥링크)이고, 아래 버튼은 <code style={S.code}>AlphaSecAdapter</code>의 실제
              메서드를 호출합니다. 완주하려면 실제 Axim 앱 + Kairos 테스트넷이 필요합니다.
            </p>
          </div>
        </header>

        {!isConfigured && (
          <div style={S.warn}>
            ⚠️ <b>VITE_WC_PROJECT_ID 미설정</b> — 실제 WalletConnect 페어링을 켜려면{" "}
            <a href="https://cloud.reown.com" target="_blank" rel="noreferrer" style={{ color: "#7aa7ff" }}>
              cloud.reown.com
            </a>
            에서 project id를 발급받아 <code style={S.code}>examples/react-rainbowkit/.env</code>에{" "}
            <code style={S.code}>VITE_WC_PROJECT_ID=…</code>로 넣고 dev 서버를 재시작하세요. (이 값이 있어야
            <code style={S.code}>createAximConnector</code>/<code style={S.code}>aximWallet</code>이 실제 relay에 붙습니다.)
          </div>
        )}

        <div style={S.row}>
          <ConnectButton />
          {isConnected && (
            <span style={S.acct}>
              {address} · chain {chainId}
            </span>
          )}
        </div>

        {isConnected ? (
          <div style={S.actions}>
            <button style={S.btn} onClick={run("authorizeSession", (v) => v.authorizeSession({ expiryDays: 30 }))}>
              세션 인가 (EIP-712)
            </button>
            <button style={S.btn} onClick={run("deposit 100 USDT", (v) => v.deposit("USDT", "100"))}>
              입금 (L1→L2)
            </button>
            <button style={S.btn} onClick={run("withdraw 50 USDT", (v) => v.withdraw("USDT", "50"))}>
              출금 (L2→L1)
            </button>
            <button style={S.btn} onClick={run("getVenueBalance USDT", (v) => v.getVenueBalance("USDT"))}>
              잔고 조회
            </button>
          </div>
        ) : (
          <p style={S.hint}>먼저 “Connect with Axim”으로 연결하세요.</p>
        )}

        <div style={S.logCard}>
          <div style={S.logHead}>SDK call log</div>
          <pre style={S.logBody}>
            {log.length === 0
              ? "아직 호출 없음."
              : log.map((l, i) => (
                  <div key={i} style={{ color: l.kind === "ok" ? "#9fe6b6" : l.kind === "err" ? "#ff9d9d" : "#a9c4ff" }}>
                    <span style={{ color: "#5c6a86" }}>{l.t}</span>  {l.text}
                  </div>
                ))}
          </pre>
        </div>

        <p style={S.foot}>
          코드: <code style={S.code}>src/wagmi.ts</code> (aximWallet + RainbowKit),{" "}
          <code style={S.code}>src/App.tsx</code> (AlphaSecAdapter). 문서:{" "}
          <code style={S.code}>docs/integration-alphasec.md</code>.
        </p>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a1020", color: "#e6ebf5", fontFamily: "-apple-system,Segoe UI,Roboto,'Noto Sans KR',sans-serif" },
  wrap: { maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" },
  head: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 22 },
  logo: { width: 38, height: 38, borderRadius: 10, background: "#0F1B3D", color: "#7aa7ff", display: "grid", placeItems: "center", fontSize: 20, flex: "0 0 auto" },
  h1: { fontSize: 19, margin: 0 },
  code: { fontFamily: "ui-monospace,Menlo,monospace", color: "#7aa7ff", fontSize: "0.92em" },
  sub: { color: "#8a95b5", fontSize: 13.5, margin: "6px 0 0", lineHeight: 1.6 },
  warn: { border: "1px solid #5b4a1f", background: "rgba(245,158,11,.08)", color: "#f0c66a", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, marginBottom: 16 },
  row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 },
  acct: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#8a95b5" },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 },
  btn: { font: "inherit", cursor: "pointer", borderRadius: 10, border: "1px solid #22304f", background: "#16213f", color: "#e6ebf5", padding: "10px 14px" },
  hint: { color: "#8a95b5", fontSize: 13 },
  logCard: { background: "linear-gradient(180deg,#111a33,#0e1730)", border: "1px solid #22304f", borderRadius: 14, padding: 16 },
  logHead: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8a95b5", marginBottom: 10 },
  logBody: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap" },
  foot: { color: "#8a95b5", fontSize: 12, marginTop: 20, lineHeight: 1.7 },
};
