import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface StoredEvent {
  type: string;
  state: string;
  timestamp: string;
  agentId?: string;
  data?: Record<string, unknown>;
}

export class EventStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  getPath(sessionId: string): string {
    return join(this.dir, `${sessionId}.jsonl`);
  }

  append(sessionId: string, event: StoredEvent): void {
    const path = this.getPath(sessionId);
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(path, JSON.stringify(event) + "\n");
  }

  load(sessionId: string): StoredEvent[] {
    const path = this.getPath(sessionId);
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8");
    const events: StoredEvent[] = [];
    for (const line of content.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // ponytail: skip corrupt lines, log if needed later
      }
    }
    return events;
  }
}
