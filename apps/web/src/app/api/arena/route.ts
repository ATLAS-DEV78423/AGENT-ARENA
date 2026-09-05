import { NextRequest } from "next/server";
import { runArena } from "@/lib/arena/runtime";
import { createRun, push, subscribe } from "@/lib/arena/run-registry";
import type { Receipt } from "@/lib/types";

const encoder = new TextEncoder();

function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`);
}

export async function POST(request: NextRequest) {
  let body: { agents?: unknown; prompt?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agents = body.agents;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (
    !Array.isArray(agents) ||
    agents.length !== 2 ||
    agents.some((a) => typeof a !== "string") ||
    !prompt
  ) {
    return Response.json(
      { error: "Send exactly two agent ids and a non-empty prompt." },
      { status: 400 },
    );
  }
  const agentIds = agents as string[];

  // The client generates the session id and sends it so a reload can reconnect
  // to this same run; a curl caller without one still gets a working stream.
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId
      ? body.sessionId
      : `arena-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // The run is decoupled from this request: it starts immediately and keeps
  // running (and buffering frames) even if the connection dies, so the
  // reloaded page can reconnect via GET /api/arena/[sessionId]/stream.
  const run = createRun(sessionId);
  void runArena({
    task: prompt,
    requestedIds: agentIds,
    onSession: (mode) => push(run, "session.mode", { mode }),
    onChat: (message) => push(run, "message", message as unknown as Record<string, unknown>),
    onPhase: (phase) => push(run, "phase", phase as unknown as Record<string, unknown>),
    onReceipt: (receipt: Receipt) =>
      push(run, "receipt", receipt as unknown as Record<string, unknown>),
  })
    .then((result) =>
      push(run, "session.completed", {
        outcome: result.outcome,
        rounds: result.rounds,
        mode: result.mode,
      }),
    )
    .catch((error) => push(run, "error", { message: String(error) }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await subscribe(run, 0, (frame) => {
        controller.enqueue(sseFrame(frame.event, frame.data));
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
