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
      { trigger: "Independent analysis", response: { kind: "analysis", content: "Analysis done." } },
      { trigger: "Other analysis", response: { kind: "message", content: "I agree." } },
      { trigger: "Discuss", response: { kind: "message", content: "Plan: incremental with tests." } },
      { trigger: "Approve plan", response: { kind: "plan_approved", content: "Approved." } },
      { trigger: "Implement", response: { kind: "message", content: "Done." } },
      { trigger: "Review", response: { kind: "review_approved", content: "Looks good." } },
      { trigger: "Final approval", response: { kind: "final_approved", content: "Final OK." } },
    ];
  }

  async start(config: { task: string; cwd: string }) {
    return { sessionId: "fake-" + this.id, pid: 1234 };
  }

  async sendAndReceive(_handle: { sessionId: string }, message: string): Promise<AgentResponse> {
    // Each adapter has its own steps and index - each invocation advances independently
    
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

  static disagreeing(id: AgentId, name: string): FakeOrchestratorAdapter {
    return new FakeOrchestratorAdapter(id, name, [
      { trigger: "Independent analysis", response: { kind: "analysis", content: "Analysis." } },
      { trigger: "Other analysis", response: { kind: "message", content: "Noted." } },
      { trigger: "Discuss", response: { kind: "message", content: "Disagree." } },
      { trigger: "Approve plan", response: { kind: "plan_rejected", content: "Rejected." } },
      { trigger: "Implement", response: { kind: "message", content: "Done." } },
      { trigger: "Review", response: { kind: "review_approved", content: "OK." } },
      { trigger: "Final approval", response: { kind: "final_approved", content: "OK." } },
    ]);
  }
}
