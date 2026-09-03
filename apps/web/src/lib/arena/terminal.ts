import type { SessionStatus } from "@/lib/types";

/**
 * What the server's stream last said about a run. The store captures these two
 * events while reading the SSE stream and applies the decision when it ends —
 * a server-side failure must tag the session `error`, never `completed`.
 */
export type TerminalSignal =
  | { kind: "completed"; outcome: string }
  | { kind: "error" }
  | { kind: "none" };

/**
 * Terminal status for a session whose stream has ended.
 * Only an explicit error signal (event or `outcome: "error"`) tags the session
 * error; a clean no-consensus end (`timeout`) is honest history, not a failure,
 * and a stream that ends without a terminal event keeps the legacy completed.
 */
export function terminalStatus(signal: TerminalSignal): SessionStatus {
  if (signal.kind === "error") return "error";
  if (signal.kind === "completed") return signal.outcome === "error" ? "error" : "completed";
  return "completed";
}
