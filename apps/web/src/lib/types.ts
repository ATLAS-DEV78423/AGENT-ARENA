export interface Agent {
  id: string;
  name: string;
  provider: string;
  status: "online" | "offline" | "thinking";
  model?: string;
}

export interface Message {
  id: string;
  role: "user" | "agent" | "arena" | "judge";
  agentId?: string;
  agentName?: string;
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  title: string;
  type: "chat" | "arena";
  agents: string[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
