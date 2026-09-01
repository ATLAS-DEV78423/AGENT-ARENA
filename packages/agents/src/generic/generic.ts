import { execFile } from "node:child_process";
import {
  AgentId,
  AgentCapabilities,
  AgentStatus,
  agentId,
  AgentResponse,
} from "@arena/core";
import { OrchestratorAdapter } from "@arena/core";
import { PtyAgentAdapter } from "@arena/pty";
import {
  AgentAdapter,
  AgentSessionHandle,
  DetectionResult,
} from "../adapter.js";

export interface GenericAgentConfig {
  id: string;
  command: string;
  args?: string[];
  name?: string;
  env?: Record<string, string>;
}

export class GenericAgentAdapter
  implements AgentAdapter, OrchestratorAdapter
{
  readonly id: AgentId;
  readonly name: string;
  private config: GenericAgentConfig;
  private ptyAdapter: PtyAgentAdapter;
  private detected = false;

  constructor(config: GenericAgentConfig) {
    this.config = config;
    this.id = agentId(config.id);
    this.name = config.name ?? config.id;
    this.ptyAdapter = new PtyAgentAdapter(
      this.id,
      this.name,
      config.command,
      config.args ?? [],
    );
  }

  async detect(): Promise<DetectionResult> {
    return new Promise((resolve) => {
      execFile(
        this.config.command,
        ["--version"],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            this.detected = false;
            resolve({
              detected: false,
              command: this.config.command,
            });
            return;
          }
          this.detected = true;
          resolve({
            detected: true,
            command: this.config.command,
            version: stdout.trim().split("\n")[0],
          });
        },
      );
    });
  }

  async start(config: {
    task: string;
    cwd: string;
  }): Promise<AgentSessionHandle> {
    return this.ptyAdapter.start(config);
  }

  async sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse> {
    return this.ptyAdapter.sendAndReceive(handle, message);
  }

  async send(
    _handle: AgentSessionHandle,
    _message: string,
  ): Promise<void> {
    // Use sendAndReceive instead
  }

  async interrupt(
    handle: AgentSessionHandle,
  ): Promise<void> {
    await this.ptyAdapter.terminate(handle);
  }

  async terminate(
    handle: AgentSessionHandle,
  ): Promise<void> {
    await this.ptyAdapter.terminate(handle);
  }

  async getStatus(
    _handle: AgentSessionHandle,
  ): Promise<AgentStatus> {
    return "running";
  }

  async capabilities(): Promise<AgentCapabilities> {
    return {
      terminal: true,
      filesystem: true,
      shell: true,
      mcp: false,
      plugins: false,
      network: false,
      interactive: true,
      supportsInterrupt: true,
      supportsResume: false,
    };
  }
}
