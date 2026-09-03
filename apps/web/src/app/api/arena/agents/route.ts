import { getRoster } from "@/lib/arena/runtime";

// GET /api/arena/agents — the agents this host can actually run
export async function GET() {
  const { agents, live } = await getRoster();
  return Response.json({ agents, live });
}
