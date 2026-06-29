export type AximErrorCode =
  | "USER_REJECTED"
  | "TIMEOUT"
  | "DISCONNECTED"
  | "NOT_CONNECTED"
  | "CHAIN_NOT_SUPPORTED"
  | "REQUEST_FAILED"
  | "NOT_IMPLEMENTED";

/** All SDK errors are AximError with a stable `code` for predictable handling. */
export class AximError extends Error {
  readonly code: AximErrorCode;
  readonly cause?: unknown;
  constructor(code: AximErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AximError";
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, AximError.prototype);
  }
}

export const errUserRejected = (msg = "User rejected the request") =>
  new AximError("USER_REJECTED", msg);
export const errTimeout = (msg = "Request timed out") => new AximError("TIMEOUT", msg);
export const errDisconnected = (msg = "Wallet disconnected") =>
  new AximError("DISCONNECTED", msg);
export const errNotConnected = (msg = "Not connected — call connect() first") =>
  new AximError("NOT_CONNECTED", msg);
export const errChainNotSupported = (chainId: number) =>
  new AximError("CHAIN_NOT_SUPPORTED", `Chain ${chainId} is not supported`);
export const errNotImplemented = (what: string) =>
  new AximError("NOT_IMPLEMENTED", `${what}: not yet implemented (preview)`);

/** Map an EIP-1193 / JSON-RPC provider error to an AximError. */
export function fromProviderError(e: unknown): AximError {
  const code = (e as { code?: number } | null)?.code;
  if (code === 4001) return errUserRejected();
  if (code === 4900 || code === 4901) return errDisconnected();
  const message = (e as { message?: string } | null)?.message ?? "Provider request failed";
  return new AximError("REQUEST_FAILED", message, e);
}
