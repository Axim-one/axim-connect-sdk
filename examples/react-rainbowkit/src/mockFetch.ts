// Mock 모드용 fetch — AlphaSec REST 응답만 로컬로 흉내낸다(지갑 서명은 실제).
// AlphaSecAdapter.fetchImpl 로 주입한다. 매핑 대상:
//   GET  /api/v1/market/tokens            → USDT L1 주소(테스트넷 placeholder 대체)
//   GET  /api/v1/wallet/balance           → L2 잔고
//   POST /api/v1/wallet/session[/delete]  → 세션 생성/삭제 제출 결과
//   POST /api/v1/wallet/withdraw          → 출금 제출 결과
// 그 외 경로는 실제 네트워크로 통과(입금 broadcast 등은 지갑/relayer가 처리).

type LogFn = (msg: string) => void;

// 데모용 mock tx 해시(0x + 64 hex). 실제 온체인 값 아님.
function mockTxHash(tag: string): `0x${string}` {
  const seed = `${tag}${Date.now()}`;
  let h = "";
  for (let i = 0; i < 64; i++) h += "0123456789abcdef"[(seed.charCodeAt(i % seed.length) + i * 7) & 15];
  return `0x${h}`;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** AlphaSec REST를 흉내내는 fetch. 매칭 안 되는 URL은 실제 fetch로 통과. */
export function makeMockFetch(logFn?: LogFn): typeof fetch {
  const log = logFn ?? (() => {});
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();

    // GET /market/tokens — 테스트넷 USDT L1 주소 placeholder 해소용.
    if (path.endsWith("/api/v1/market/tokens")) {
      log("GET /market/tokens");
      return json({
        code: 0,
        result: {
          tokens: [
            { id: 1, symbol: "KAIA", l1Address: "0x0000000000000000000000000000000000000000" },
            { id: 2, symbol: "USDT", l1Address: "0x1111111111111111111111111111111111111111" },
          ],
        },
      });
    }

    // GET /wallet/balance — 데모 잔고.
    if (path.endsWith("/api/v1/wallet/balance")) {
      log("GET /wallet/balance");
      return json({
        code: 0,
        result: { balances: [{ tokenId: "2", locked: "12.500000", unlocked: "1234.567890" }] },
      });
    }

    // POST /wallet/session/delete — 세션 해지(type-3) 제출.
    if (method === "POST" && path.endsWith("/api/v1/wallet/session/delete")) {
      const txHash = mockTxHash("delete");
      log(`POST /wallet/session/delete → applied (${txHash.slice(0, 10)}…)`);
      return json({ code: 0, result: { txHash, applied: true } });
    }

    // POST /wallet/session — 세션 인가(type-1) 제출.
    if (method === "POST" && path.endsWith("/api/v1/wallet/session")) {
      const txHash = mockTxHash("session");
      log(`POST /wallet/session → applied (${txHash.slice(0, 10)}…)`);
      return json({ code: 0, result: { txHash, applied: true } });
    }

    // POST /wallet/withdraw — 출금 제출.
    if (method === "POST" && path.endsWith("/api/v1/wallet/withdraw")) {
      const txHash = mockTxHash("withdraw");
      log(`POST /wallet/withdraw → ${txHash.slice(0, 10)}…`);
      return json({ code: 0, result: { txHash } });
    }

    // 매칭 안 됨 → 실제 네트워크(입금 broadcast 등).
    log(`passthrough ${method} ${path}`);
    return fetch(input, init);
  };
}
