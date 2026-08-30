import { ErrorCode } from "./codes.js";

const RECOVERABLE = new Set([
  ErrorCode.AGENT_TIMEOUT,
  ErrorCode.AGENT_CRASHED,
  ErrorCode.AGENT_NOT_FOUND,
]);

export { ErrorCode } from "./codes.js";

export class ArenaError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;
  readonly recoverable: boolean;

  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ArenaError";
    this.code = code;
    this.context = context;
    this.recoverable = RECOVERABLE.has(code);
  }

  toUserMessage(): string {
    const parts = [this.code + ": " + this.message];
    if (this.context?.suggestion) parts.push(String(this.context.suggestion));
    return parts.join(String.fromCharCode(10));
  }
}

export function createError(code: ErrorCode, message: string, context?: Record<string, unknown>): ArenaError {
  return new ArenaError(code, message, context);
}
