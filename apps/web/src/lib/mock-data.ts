import type { Agent } from "./types";

export const AGENTS: Agent[] = [
  { id: "claude", name: "Claude", provider: "Anthropic", status: "online", model: "claude-sonnet-4-20250514" },
  { id: "gpt", name: "GPT", provider: "OpenAI", status: "online", model: "gpt-4o" },
  { id: "gemini", name: "Gemini", provider: "Google", status: "offline", model: "gemini-2.5-pro" },
  { id: "qwen", name: "Qwen", provider: "Open source", status: "offline" },
];
