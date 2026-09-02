import { AgentId } from "./types/common.js";
import { OrchestratorAdapter, AgentResponse } from "./orchestrator.js";

export class FakeOrchestratorAdapter implements OrchestratorAdapter {
  readonly id: AgentId;
  readonly name: string;
  private steps: Array<{ trigger: string; response: AgentResponse }>;
  private stepIndex = 0;

  constructor(id: AgentId, name: string, steps?: Array<{ trigger: string; response: AgentResponse }>) {
    this.id = id;
    this.name = name;
    this.steps = steps ?? FakeOrchestratorAdapter.defaultSteps();
  }

  static defaultSteps(): Array<{ trigger: string; response: AgentResponse }> {
    return [
      { trigger: "independently", response: { kind: "analysis", content: "Analysis done." } },
      { trigger: "review their", response: { kind: "message", content: "I agree." } },
      { trigger: "approve only", response: { kind: "plan_approved", content: "Approved." } },
      { trigger: "current role: builder", response: { kind: "message", content: "Done." } },
      { trigger: "current role: reviewer", response: { kind: "review_approved", content: "Looks good." } },
      { trigger: "final approval", response: { kind: "final_approved", content: "Final OK." } },
    ];
  }

  async start(_config: { task: string; cwd: string }) {
    return { sessionId: "fake-" + this.id, pid: 1234 };
  }

  async sendAndReceive(_handle: { sessionId: string }, message: string): Promise<AgentResponse> {
    for (let i = this.stepIndex; i < this.steps.length; i++) {
      const step = this.steps[i]!;
      if (message.toLowerCase().includes(step.trigger.toLowerCase())) {
        this.stepIndex = i + 1;
        return step.response;
      }
    }
    return { kind: "message", content: "ack" };
  }

  async terminate() {}

  static withFindings(id: AgentId, name: string): FakeOrchestratorAdapter {
    return new FakeOrchestratorAdapter(id, name, [
      { trigger: "independently", response: { kind: "analysis", content: "Analysis." } },
      { trigger: "review their", response: { kind: "message", content: "Noted." } },
      { trigger: "approve only", response: { kind: "plan_approved", content: "Approved." } },
      { trigger: "current role: reviewer", response: { kind: "finding", content: "Blocker: missing null check in auth flow." } },
      { trigger: "find each finding", response: { kind: "message", content: "Done." } },
      { trigger: "current role: builder", response: { kind: "message", content: "Done." } },
      { trigger: "final approval", response: { kind: "final_approved", content: "OK." } },
    ]);
  }

  static disagreeing(id: AgentId, name: string): FakeOrchestratorAdapter {
    return new FakeOrchestratorAdapter(id, name, [
      { trigger: "independently", response: { kind: "analysis", content: "Analysis." } },
      { trigger: "review their", response: { kind: "message", content: "Noted." } },
      { trigger: "approve only", response: { kind: "plan_rejected", content: "Rejected." } },
      { trigger: "current role: builder", response: { kind: "message", content: "Done." } },
      { trigger: "current role: reviewer", response: { kind: "review_approved", content: "OK." } },
      { trigger: "final approval", response: { kind: "final_approved", content: "OK." } },
    ]);
  }
}
