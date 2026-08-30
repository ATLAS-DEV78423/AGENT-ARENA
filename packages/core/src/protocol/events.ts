import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ProtocolEvent } from "../types/protocol.js";
import { SessionId } from "../types/common.js";

export class EventStore {
  private filePath: string;
  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  async append(event: ProtocolEvent): Promise<void> {
    appendFileSync(this.filePath, JSON.stringify(event) + "\n", "utf-8");
  }
  async readAll(): Promise<ProtocolEvent[]> {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, "utf-8");
    return content.split("\n").filter((l: string) => l.trim()).map((l: string) => JSON.parse(l) as ProtocolEvent);
  }
  async readBySession(sid: SessionId): Promise<ProtocolEvent[]> {
    return (await this.readAll()).filter(e => e.sessionId === sid);
  }
}
