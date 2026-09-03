import { NextRequest } from "next/server";
import { runArena } from "@/lib/arena/runtime";

export async function POST(request: NextRequest) {
  let body: { agents?: unknown; prompt?: unknown };
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

  const sessionId = `arena-${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify({ event, data })}\n\n`);
      };

      send("session.created", { sessionId });
      try {
        const result = await runArena({
          task: prompt,
          requestedIds: agentIds,
          // Abort the run (agents terminated, session marked error) when the
          // client disconnects — e.g. the user reloads mid-arena.
          signal: request.signal,
          onSession: (mode) => send("session.mode", { mode }),
          onChat: (message) => send("message", message),
          onPhase: (phase) => send("phase", phase),
          onReceipt: (receipt) => send("receipt", receipt),
        });

        send("session.completed", {
          outcome: result.outcome,
          rounds: result.rounds,
          mode: result.mode,
        });
      } catch (error) {
        send("error", { message: String(error) });
      }
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
