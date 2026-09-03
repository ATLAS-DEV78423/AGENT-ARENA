import { create } from "zustand";
import { Agent, Message, Session, AGENTS, MOCK_SESSIONS } from "./mock-data";

interface ArenaStore {
  agents: Agent[];
  sessions: Session[];
  activeSessionId: string | null;
  selectedAgentIds: string[];
  commandPaletteOpen: boolean;
  settingsOpen: boolean;

  // Actions
  setActiveSession: (id: string | null) => void;
  toggleAgent: (id: string) => void;
  sendMessage: (content: string) => void;
  startArena: (agentIds: string[], prompt: string) => Promise<void>;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useStore = create<ArenaStore>((set, get) => ({
  agents: AGENTS,
  sessions: MOCK_SESSIONS,
  activeSessionId: null,
  selectedAgentIds: ["claude", "gpt"],
  commandPaletteOpen: false,
  settingsOpen: false,

  setActiveSession: (id) => set({ activeSessionId: id }),

  toggleAgent: (id) =>
    set((state) => ({
      selectedAgentIds: state.selectedAgentIds.includes(id)
        ? state.selectedAgentIds.filter((a) => a !== id)
        : [...state.selectedAgentIds, id],
    })),

  sendMessage: (content) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                {
                  id: `m-${Date.now()}`,
                  role: "user" as const,
                  content,
                  timestamp: new Date(),
                },
              ],
              updatedAt: new Date(),
            }
          : s
      ),
    }));
  },

  startArena: async (agentIds, prompt) => {
    const sessionId = `arena-${Date.now()}`;

    // Create session immediately with user message
    const newSession: Session = {
      id: sessionId,
      title: prompt.slice(0, 50) + (prompt.length > 50 ? "..." : ""),
      type: "arena",
      agents: agentIds,
      messages: [
        {
          id: `m-${Date.now()}`,
          role: "user",
          content: prompt,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: sessionId,
    }));

    try {
      const response = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: agentIds, prompt }),
      });

      if (!response.ok) throw new Error("Failed to start arena");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const { event, data } = JSON.parse(line.slice(6));

              if (event === "message") {
                const agentNames: Record<string, string> = {
                  claude: "Claude",
                  gpt: "GPT",
                  gemini: "Gemini",
                  qwen: "Qwen",
                };

                set((state) => ({
                  sessions: state.sessions.map((s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          messages: [
                            ...s.messages,
                            {
                              id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              role: data.role as "arena" | "judge",
                              agentId: data.agentId,
                              agentName: data.role === "judge"
                                ? "Judge"
                                : agentNames[data.agentId] || data.agentId || data.role,
                              content: data.content,
                              timestamp: new Date(),
                            },
                          ],
                        }
                      : s
                  ),
                }));
              }

              if (event === "session.completed") {
                set((state) => ({
                  sessions: state.sessions.map((s) =>
                    s.id === sessionId
                      ? { ...s, updatedAt: new Date() }
                      : s
                  ),
                }));
              }

              if (event === "error") {
                console.error("Arena error:", data);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch (error) {
      console.error("Arena request failed:", error);
      // Fall back to mock responses
      const { ARENA_RESPONSES } = await import("./mock-data");
      const agentNames: Record<string, string> = {
        claude: "Claude",
        gpt: "GPT",
        gemini: "Gemini",
      };

      agentIds.forEach((agentId, idx) => {
        setTimeout(() => {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: [
                      ...s.messages,
                      {
                        id: `m-${Date.now()}-${agentId}`,
                        role: "arena" as const,
                        agentId,
                        agentName: agentNames[agentId] || agentId,
                        content: ARENA_RESPONSES[agentId] || `Response from ${agentId}`,
                        timestamp: new Date(),
                      },
                    ],
                  }
                : s
            ),
          }));
        }, 2000 + idx * 1500);
      });

      setTimeout(() => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: `m-${Date.now()}-judge`,
                      role: "judge" as const,
                      agentId: "judge",
                      agentName: "Judge",
                      content: ARENA_RESPONSES.judge,
                      timestamp: new Date(),
                    },
                  ],
                }
              : s
          ),
        }));
      }, 2000 + agentIds.length * 1500 + 2000);
    }
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
