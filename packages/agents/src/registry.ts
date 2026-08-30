import { AgentAdapter, DetectionResult } from "./adapter.js";

export interface DetectionEntry { adapter: AgentAdapter; detected: boolean; result: DetectionResult; }

export class AgentRegistry {
  private adapters = new Map<string, AgentAdapter>();
  register(a: AgentAdapter) { this.adapters.set(a.id, a); }
  getAll(): AgentAdapter[] { return [...this.adapters.values()]; }
  getById(id: string): AgentAdapter | undefined { return this.adapters.get(id); }
  async detectAll(): Promise<DetectionEntry[]> {
    return Promise.all([...this.adapters.values()].map(async a => {
      const result = await a.detect();
      return { adapter: a, detected: result.detected, result };
    }));
  }
  async getDetected(): Promise<AgentAdapter[]> {
    const all = await this.detectAll();
    return all.filter(e => e.detected).map(e => e.adapter);
  }
}
