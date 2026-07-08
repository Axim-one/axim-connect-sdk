import { useCallback, useState, type CSSProperties } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { AlphaSecAdapter } from "@axim/connect-alphasec";
import type { Balance, Eip1193Provider, SessionGrant } from "@axim/connect";
import { isConfigured } from "./wagmi";
import { makeMockFetch } from "./mockFetch";

type LogKind = "run" | "ok" | "err" | "info";
interface LogLine {
  kind: LogKind;
  text: string;
  t: string;
}

export function App() {
  const { connector, address, isConnected, chainId } = useAccount();
  const [log, setLog] = useState<LogLine[]>([]);
  const [mock, setMock] = useState(true); // 기본 ON: AlphaSec 없이 완주 시연
  const [grant, setGrant] = useState<SessionGrant | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [depositAmt, setDepositAmt] = useState("100");
  const [withdrawAmt, setWithdrawAmt] = useState("50");
  const [busy, setBusy] = useState(false);

  const push = useCallback((kind: LogKind, text: string) => {
    const t = new Date().toLocaleTimeString("en-GB");
    setLog((l) => [{ kind, text, t }, ...l].slice(0, 80));
  }, []);

  // Build a real AlphaSecAdapter from the connected wallet's EIP-1193 provider.
  // In mock mode, AlphaSec REST calls are served by a local mock — the wallet
  // still signs for real, so every approval screen is exercised end-to-end.
  const getVenue = useCallback(async (): Promise<AlphaSecAdapter> => {
    if (!connector) throw new Error("지갑이 연결되지 않았습니다.");
    const provider = (await connector.getProvider()) as Eip1193Provider;
    return new AlphaSecAdapter({
      provider,
      network: "mainnet",
      ...(mock ? { fetchImpl: makeMockFetch((m) => push("info", `mock ← ${m}`)) } : {}),
    });
  }, [connector, mock, push]);

  // Wrap a real SDK call: log start/result/error, run exclusively (busy gate).
  const run = useCallback(
    (label: string, fn: (v: AlphaSecAdapter) => Promise<unknown>) => async () => {
      if (busy) return;
      setBusy(true);
      push("run", `▶ ${label} …`);
      try {
        const venue = await getVenue();
        const result = await fn(venue);
        push("ok", `✓ ${label} → ${JSON.stringify(result)}`);
        return result;
      } catch (e) {
        const err = e as { code?: string; message?: string };
        push("err", `✗ ${label} → ${[err.code, err.message].filter(Boolean).join(" ") || String(e)}`);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [busy, getVenue, push],
  );

  const onAuthorize = async () => {
    const g = (await run("authorizeSession", (v) => v.authorizeSession({ expiryDays: 30 }))()) as
      | SessionGrant
      | undefined;
    if (g) setGrant(g);
  };
  const onRevoke = async () => {
    if (!grant) return;
    const r = await run("revokeSession", (v) => v.revokeSession({ sessionWallet: grant.sessionAddress }))();
    if (r) setGrant(null);
  };
  const onDeposit = run(`deposit ${depositAmt} USDT`, (v) => v.deposit("USDT", depositAmt || "0"));
  const onWithdraw = run(`withdraw ${withdrawAmt} USDT`, (v) => v.withdraw("USDT", withdrawAmt || "0"));
  const onBalance = async () => {
    const b = (await run("getVenueBalance USDT", (v) => v.getVenueBalance("USDT"))()) as Balance | undefined;
    if (b) setBalance(b);
  };

  const sessionActive = !!grant && grant.expiry * 1000 > Date.now();
  const dday = grant ? Math.ceil((grant.expiry * 1000 - Date.now()) / 86_400_000) : null;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div style={S.logo}>◆</div>
          <div style={{ flex: 1 }}>
            <h1 style={S.h1}>
              AlphaSec × Axim — <code style={S.code}>@axim/connect</code> 데모 dApp
            </h1>
            <p style={S.sub}>
              실제 SDK를 호출하는 미니 거래 dApp입니다. “Connect with Axim”은 진짜 WalletConnect v2
              페어링이고, 아래 동작은 <code style={S.code}>AlphaSecAdapter</code>의 실제 메서드를 호출해
              Axim 앱에 서명 요청을 보냅니다.
            </p>
          </div>
          <label style={S.toggle} title="AlphaSec REST를 로컬 mock으로 대체 — 지갑 서명은 그대로 실제">
            <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} />
            <span>Mock 모드{mock ? " · ON" : " · OFF"}</span>
          </label>
        </header>

        {!isConfigured && (
          <div style={S.warn}>
            ⚠️ <b>VITE_WC_PROJECT_ID 미설정</b> — 실제 페어링을 켜려면{" "}
            <a href="https://cloud.reown.com" target="_blank" rel="noreferrer" style={{ color: "#7aa7ff" }}>
              cloud.reown.com
            </a>
            의 project id를 <code style={S.code}>examples/react-rainbowkit/.env</code>에{" "}
            <code style={S.code}>VITE_WC_PROJECT_ID=…</code>로 넣고 dev 서버를 재시작하세요.
          </div>
        )}

        <div style={S.modeBar}>
          {mock ? (
            <span style={S.pillMock}>
              Mock 모드: AlphaSec 정산부(세션 create/delete · 출금 · 잔고)를 로컬 스텁으로 완주. 지갑 서명은 실제.
            </span>
          ) : (
            <span style={S.pillLive}>
              Live 모드: AlphaSec 테스트넷 REST에 실제 제출. 완주하려면 AlphaSec Kairos 백엔드 필요.
            </span>
          )}
        </div>

        <div style={S.row}>
          <ConnectButton />
          {isConnected && (
            <span style={S.acct}>
              {address} · chain {chainId}
            </span>
          )}
        </div>

        {!isConnected ? (
          <p style={S.hint}>먼저 “Connect with Axim”으로 연결하세요.</p>
        ) : (
          <div style={S.grid}>
            {/* 세션 상태 카드 */}
            <div style={S.card}>
              <div style={S.cardHead}>트레이딩 세션</div>
              {sessionActive ? (
                <>
                  <div style={S.big}>
                    활성 <span style={{ color: "#9fe6b6", fontSize: 13 }}>· D-{dday}</span>
                  </div>
                  <div style={S.mono}>{grant!.sessionAddress}</div>
                  {grant!.sessionPrivateKey && (
                    <div style={S.noteDim}>세션키 앱측 생성됨 (주문 서명 전용, 마스터키 아님)</div>
                  )}
                  <button style={S.btnWarn} disabled={busy} onClick={onRevoke}>
                    세션 해지 (type-3)
                  </button>
                </>
              ) : (
                <>
                  <div style={S.bigDim}>세션 없음</div>
                  <div style={S.noteDim}>EIP-712 RegisterSessionWallet로 주문 서명 세션을 인가합니다.</div>
                  <button style={S.btn} disabled={busy} onClick={onAuthorize}>
                    세션 인가 (EIP-712)
                  </button>
                </>
              )}
            </div>

            {/* 잔고 카드 */}
            <div style={S.card}>
              <div style={S.cardHead}>L2 잔고 (USDT)</div>
              {balance ? (
                <>
                  <div style={S.big}>{balance.unlocked}</div>
                  <div style={S.noteDim}>locked {balance.locked} · unlocked {balance.unlocked}</div>
                </>
              ) : (
                <div style={S.bigDim}>—</div>
              )}
              <button style={S.btn} disabled={busy} onClick={onBalance}>
                잔고 조회
              </button>
            </div>

            {/* 입금 폼 */}
            <div style={S.card}>
              <div style={S.cardHead}>입금 (Kaia L1 → AlphaSec L2)</div>
              <div style={S.formRow}>
                <input style={S.input} value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} inputMode="decimal" />
                <span style={S.unit}>USDT</span>
              </div>
              <div style={S.noteDim}>approve → outboundTransfer(type49 대납). 실제 broadcast는 Axim relayer.</div>
              <button style={S.btn} disabled={busy} onClick={onDeposit}>
                입금 서명
              </button>
            </div>

            {/* 출금 폼 */}
            <div style={S.card}>
              <div style={S.cardHead}>출금 (AlphaSec L2 → Kaia L1)</div>
              <div style={S.formRow}>
                <input style={S.input} value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} inputMode="decimal" />
                <span style={S.unit}>USDT</span>
              </div>
              <div style={S.noteDim}>gas-free L2 서명 → REST 제출. broadcast/정산은 AlphaSec L2.</div>
              <button style={S.btn} disabled={busy} onClick={onWithdraw}>
                출금 서명
              </button>
            </div>
          </div>
        )}

        <div style={S.logCard}>
          <div style={S.logHead}>SDK call log</div>
          <pre style={S.logBody}>
            {log.length === 0
              ? "아직 호출 없음."
              : log.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      color:
                        l.kind === "ok" ? "#9fe6b6" : l.kind === "err" ? "#ff9d9d" : l.kind === "info" ? "#c9a7ff" : "#a9c4ff",
                    }}
                  >
                    <span style={{ color: "#5c6a86" }}>{l.t}</span>  {l.text}
                  </div>
                ))}
          </pre>
        </div>

        <p style={S.foot}>
          코드: <code style={S.code}>src/wagmi.ts</code> (aximWallet + RainbowKit),{" "}
          <code style={S.code}>src/App.tsx</code> (AlphaSecAdapter),{" "}
          <code style={S.code}>src/mockFetch.ts</code> (Mock 모드). 문서:{" "}
          <code style={S.code}>docs/integration-alphasec.md</code>.
        </p>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a1020", color: "#e6ebf5", fontFamily: "-apple-system,Segoe UI,Roboto,'Noto Sans KR',sans-serif" },
  wrap: { maxWidth: 900, margin: "0 auto", padding: "32px 20px 64px" },
  head: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  logo: { width: 38, height: 38, borderRadius: 10, background: "#0F1B3D", color: "#7aa7ff", display: "grid", placeItems: "center", fontSize: 20, flex: "0 0 auto" },
  h1: { fontSize: 19, margin: 0 },
  code: { fontFamily: "ui-monospace,Menlo,monospace", color: "#7aa7ff", fontSize: "0.92em" },
  sub: { color: "#8a95b5", fontSize: 13.5, margin: "6px 0 0", lineHeight: 1.6 },
  toggle: { display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, color: "#c9a7ff", background: "rgba(139,92,246,.08)", border: "1px solid #3a2f5b", borderRadius: 999, padding: "7px 12px", cursor: "pointer", flex: "0 0 auto", whiteSpace: "nowrap" },
  warn: { border: "1px solid #5b4a1f", background: "rgba(245,158,11,.08)", color: "#f0c66a", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, marginBottom: 14 },
  modeBar: { marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 },
  pillMock: { color: "#c9a7ff" },
  pillLive: { color: "#f0c66a" },
  row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 },
  acct: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#8a95b5" },
  hint: { color: "#8a95b5", fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginBottom: 20 },
  card: { background: "linear-gradient(180deg,#111a33,#0e1730)", border: "1px solid #22304f", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  cardHead: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8a95b5" },
  big: { fontSize: 22, fontWeight: 700 },
  bigDim: { fontSize: 22, fontWeight: 700, color: "#4a5677" },
  mono: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 11.5, color: "#8a95b5", wordBreak: "break-all" },
  noteDim: { fontSize: 11.5, color: "#6b769a", lineHeight: 1.55 },
  formRow: { display: "flex", alignItems: "center", gap: 8 },
  input: { flex: 1, font: "inherit", background: "#0b1428", border: "1px solid #22304f", borderRadius: 8, color: "#e6ebf5", padding: "8px 10px", minWidth: 0 },
  unit: { fontSize: 12, color: "#8a95b5" },
  btn: { font: "inherit", cursor: "pointer", borderRadius: 10, border: "1px solid #22304f", background: "#16213f", color: "#e6ebf5", padding: "9px 12px", marginTop: "auto" },
  btnWarn: { font: "inherit", cursor: "pointer", borderRadius: 10, border: "1px solid #5b2330", background: "#2a1620", color: "#ff9d9d", padding: "9px 12px", marginTop: "auto" },
  logCard: { background: "linear-gradient(180deg,#111a33,#0e1730)", border: "1px solid #22304f", borderRadius: 14, padding: 16 },
  logHead: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8a95b5", marginBottom: 10 },
  logBody: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap" },
  foot: { color: "#8a95b5", fontSize: 12, marginTop: 20, lineHeight: 1.7 },
};
