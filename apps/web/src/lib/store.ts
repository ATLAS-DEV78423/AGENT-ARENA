import { create } from "zustand";
import { Agent, Message, Session, AGENTS, MOCK_SESSIONS, ARENA_RESPONSES } from "./mock-data";

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
  startArena: (agentIds: string[], prompt: string) => void;
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
    const { activeSessionId, sessions } = get();
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

    // Simulate agent response
    setTimeout(() => {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: `m-${Date.now()}-response`,
                    role: "agent" as const,
                    agentId: "claude",
                    agentName: "Claude",
                    content: "I've analyzed your request. Here's my response based on the context of our conversation. Let me know if you'd like me to elaborate on any specific point.",
                    timestamp: new Date(),
                  },
                ],
              }
            : s
        ),
      }));
    }, 1500);
  },

  startArena: (agentIds, prompt) => {
    const sessionId = `arena-${Date.now()}`;
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

    // Simulate streaming arena responses
    const agentNames: Record<string, string> = {
      claude: "Claude",
      gpt: "GPT",
      gemini: "Gemini",
    };

    agentIds.forEach((agentId, idx) => {
      setTimeout(() => {
        const content = ARENA_RESPONSES[agentId] || "Response from " + agentId;
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
                      content,
                      timestamp: new Date(),
                    },
                  ],
                }
              : s
          ),
        }));
      }, 2000 + idx * 1500);
    });

    // Simulate judge response after all agents
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
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
