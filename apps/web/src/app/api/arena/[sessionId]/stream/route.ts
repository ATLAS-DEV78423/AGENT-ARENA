import { NextRequest } from "next/server";
import { getRun, subscribe } from "@/lib/arena/run-registry";

const encoder = new TextEncoder();

function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`);
}

// GET /api/arena/[sessionId]/stream?after=<n> — reconnects to a run started by
// POST /api/arena. Replays the run's buffered frames the client has not yet
// consumed (its persisted per-session cursor), then live frames until the run's
// terminal event. 404 when the run is gone (finished beyond the reconnect
// window, or this server process never ran it).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const run = getRun(sessionId);
  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const afterParam = new URL(request.url).searchParams.get("after");
  const after = Number.isFinite(Number(afterParam)) ? Math.max(0, Number(afterParam)) : 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Flush headers immediately: a run mid-cold-start may not push a frame
      // for minutes, and the client's reconnect fetch must resolve now so it
      // adopts ownership (and beats the lease) without waiting for a frame.
      // SSE comments are skipped by the client's parser.
      controller.enqueue(encoder.encode(": connected\n\n"));
      await subscribe(run, after, (frame) => {
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
