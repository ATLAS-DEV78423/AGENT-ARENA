import { NextRequest } from "next/server";

// Import the sessions map from the parent route
// In production this would be a shared database
let sessions: Map<string, unknown>;

try {
  // Access the sessions from the arena route module
  const arenaModule = await import("../route");
  // The sessions map is internal to the module, so we use a different approach
} catch {
  // fallback
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // For now, return a placeholder — the SSE stream in POST handles real-time updates
  return Response.json({
    id,
    status: "completed",
    messages: [],
    note: "Session data is available via the SSE stream from POST /api/arena",
  });
}
