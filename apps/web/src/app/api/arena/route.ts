import { NextRequest } from "next/server";
import { Orchestrator, FakeOrchestratorAdapter } from "@arena/core";
import { agentId } from "@arena/core";

// In-memory session store (replace with EventStore for persistence)
const sessions = new Map<string, {
  id: string;
  status: "running" | "completed" | "error";
  messages: Array<{
    id: string;
    role: "user" | "agent" | "arena" | "judge";
    agentId?: string;
    agentName?: string;
    content: string;
    timestamp: string;
  }>;
  result?: { outcome: string; rounds: number; state: string };
}>();

export async function POST(request: NextRequest) {
  const { agents, prompt } = await request.json();

  const sessionId = `arena-${Date.now()}`;

  // Create session
  sessions.set(sessionId, {
    id: sessionId,
    status: "running",
    messages: [
      {
        id: `m-${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  // Create stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify({ event, data })}\n\n`);
      };

      send("session.created", { sessionId });

      try {
        // Create fake adapters
        const adapterA = new FakeOrchestratorAdapter(
          agentId(agents[0] || "agent-a"),
          agents[0] || "Agent A"
        );
        const adapterB = new FakeOrchestratorAdapter(
          agentId(agents[1] || "agent-b"),
          agents[1] || "Agent B"
        );

        // Create a custom orchestrator that emits events to the stream
        const orch = new Orchestrator(
          {
            task: prompt,
            cwd: process.cwd(),
            maxRounds: 1,
            maxMinutes: 2,
            onLog: (msg) => send("log", { message: msg }),
          },
          adapterA,
          adapterB,
        );

        // Override emit to stream events
        const originalEmit = (orch as any).emit.bind(orch);
        (orch as any).emit = function(type: string, data?: Record<string, unknown>, agentId?: string) {
          originalEmit(type, data, agentId);

          // Map orchestrator events to chat messages
          if (type === "analysis.complete" && data) {
            const agentAContent = data.agentA as string;
            const agentBContent = data.agentB as string;

            const session = sessions.get(sessionId);
            if (session) {
              session.messages.push(
                {
                  id: `m-${Date.now()}-a`,
                  role: "arena",
                  agentId: agents[0] || "agent-a",
                  agentName: agents[0] || "Agent A",
                  content: agentAContent,
                  timestamp: new Date().toISOString(),
                },
                {
                  id: `m-${Date.now()}-b`,
                  role: "arena",
                  agentId: agents[1] || "agent-b",
                  agentName: agents[1] || "Agent B",
                  content: agentBContent,
                  timestamp: new Date().toISOString(),
                }
              );
            }
            send("message", { role: "arena", agentId: agents[0], content: agentAContent });
            send("message", { role: "arena", agentId: agents[1], content: agentBContent });
          }

          if (type === "message.created" && data) {
            const content = data.content as string;
            const messageType = data.messageType as string;
            const session = sessions.get(sessionId);
            if (session && content) {
              session.messages.push({
                id: `m-${Date.now()}-disc`,
                role: "arena",
                agentId: agentId,
                agentName: agentId === (agents[0] || "agent-a") ? (agents[0] || "Agent A") : (agents[1] || "Agent B"),
                content,
                timestamp: new Date().toISOString(),
              });
            }
            send("message", { role: "arena", agentId, content });
          }

          if (type === "consensus.reached") {
            const session = sessions.get(sessionId);
            if (session) {
              session.messages.push({
                id: `m-${Date.now()}-judge`,
                role: "judge",
                agentId: "judge",
                agentName: "Judge",
                content: `Arena session completed. Both agents reached consensus on the approach.\n\n**Outcome:** The agents collaborated on: ${prompt}`,
                timestamp: new Date().toISOString(),
              });
            }
            send("message", { role: "judge", content: "Arena session completed." });
          }

          if (type === "error") {
            const session = sessions.get(sessionId);
            if (session) {
              session.status = "error";
            }
            send("error", data);
          }
        };

        const result = await orch.run();

        const session = sessions.get(sessionId);
        if (session) {
          session.status = "completed";
          session.result = {
            outcome: result.outcome,
            rounds: result.rounds,
            state: result.state,
          };
        }

        send("session.completed", {
          sessionId,
          outcome: result.outcome,
          rounds: result.rounds,
        });
      } catch (error) {
        const session = sessions.get(sessionId);
        if (session) session.status = "error";
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

// GET /api/arena — list sessions
export async function GET() {
  const list = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    status: s.status,
    messageCount: s.messages.length,
    result: s.result,
  }));
  return Response.json(list);
}
