import { randomUUID } from "node:crypto";
import { AgentId, AgentCapabilities, AgentStatus, sessionId } from "@arena/core";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "../adapter.js";

export class FakeAgentAdapter implements AgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  private steps: { trigger: string; response: string }[];
  private stepIndex = 0;
  private outputCallbacks: Array<(data: string) => void> = [];

  constructor(id: AgentId, name: string, steps: { trigger: string; response: string }[] = []) {
    this.id = id; this.name = name; this.steps = steps;
  }

  onOutput(cb: (data: string) => void) { this.outputCallbacks.push(cb); }
  async detect(): Promise<DetectionResult> { return { detected: true, command: this.name.toLowerCase(), version: "fake-1.0" }; }
  async start(config: { task: string; cwd: string }) {
    const handle = { sessionId: sessionId(randomUUID()), pid: Math.floor(Math.random() * 100000) + 1000 };
    this.emit("[" + this.name + "] Ready. Task: " + config.task);
    return handle;
  }
  async send(_handle: AgentSessionHandle, message: string) {
    if (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex]!;
      if (message.toLowerCase().includes(step.trigger.toLowerCase())) {
        this.emit("[" + this.name + "] " + step.response);
        this.stepIndex++;
        return;
      }
    }
    this.emit("[" + this.name + "] Acknowledged.");
  }
  async interrupt() { this.emit("[" + this.name + "] Interrupted."); }
  async terminate() { this.emit("[" + this.name + "] Terminated."); }
  async getStatus(): Promise<AgentStatus> { return "running"; }
  async capabilities(): Promise<AgentCapabilities> {
    return { terminal: true, filesystem: true, shell: true, mcp: false, plugins: false, network: false, interactive: true, supportsInterrupt: true, supportsResume: false };
  }
  private emit(data: string) { for (const cb of this.outputCallbacks) cb(data); }
}
