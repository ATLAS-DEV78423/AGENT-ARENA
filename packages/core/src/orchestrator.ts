import { SessionId, AgentId } from "./types/common.js";
import { ArenaState } from "./types/state-machine.js";
import { SessionManager } from "./session/manager.js";

export type AgentResponseKind =
  | "analysis" | "message" | "plan_approved" | "plan_rejected"
  | "finding" | "review_approved" | "review_rejected"
  | "final_approved" | "final_rejected" | "error" | "timeout" | "crash";

export interface AgentResponse { kind: AgentResponseKind; content: string; data?: Record<string, unknown>; }
export interface OrchestratorConfig { task: string; cwd: string; maxRounds?: number; maxMinutes?: number; }
export interface OrchestratorEvent { type: string; state: ArenaState; agentId?: AgentId; data?: Record<string, unknown>; timestamp: string; }
export interface OrchestratorResult { state: ArenaState; outcome: "consensus" | "timeout" | "error"; rounds: number; events: OrchestratorEvent[]; }

export interface OrchestratorAdapter {
  id: AgentId; name: string;
  start(config: { task: string; cwd: string }): Promise<{ sessionId: string; pid: number }>;
  sendAndReceive(handle: { sessionId: string }, message: string): Promise<AgentResponse>;
  terminate(handle: { sessionId: string }): Promise<void>;
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private adapterA: OrchestratorAdapter;
  private adapterB: OrchestratorAdapter;
  private manager: SessionManager;
  private events: OrchestratorEvent[] = [];
  private hA: { sessionId: string } | null = null;
  private hB: { sessionId: string } | null = null;
  private sid!: SessionId;

  constructor(config: OrchestratorConfig, a: OrchestratorAdapter, b: OrchestratorAdapter, mgr?: SessionManager) {
    this.config = config; this.adapterA = a; this.adapterB = b; this.manager = mgr ?? new SessionManager();
  }

  async run(): Promise<OrchestratorResult> {
    try {
      const s = await this.manager.createSession({
        task: this.config.task, agentA: this.adapterA.id, agentB: this.adapterB.id,
        budget: { maxRounds: this.config.maxRounds ?? 3, maxMinutes: this.config.maxMinutes ?? 10 },
      });
      this.sid = s.id;
      this.emit("session.created");
      this.trans("initialize"); this.emit("session.initialized");
      this.hA = await this.adapterA.start({ task: this.config.task, cwd: this.config.cwd });
      this.hB = await this.adapterB.start({ task: this.config.task, cwd: this.config.cwd });
      this.trans("environment_checked");
      this.emit("environment.checked");

      // 1. Independent analysis (analysis barrier: sequential, no sharing)
      const rA1 = await this.adapterA.sendAndReceive(this.hA, "Independent analysis: " + this.config.task);
      const rB1 = await this.adapterB.sendAndReceive(this.hB, "Independent analysis: " + this.config.task);
      this.trans("analysis_complete"); this.emit("analysis.started"); // ENVIRONMENT_CHECK -> ANALYZING
      this.trans("analysis_complete"); // ANALYZING -> DISCUSSING
      this.emit("analysis.complete", { agentA: rA1.content, agentB: rB1.content });

      // 2. Discussion (exchange analyses)
      await this.adapterA.sendAndReceive(this.hA, "Other analysis: " + rB1.content);
      await this.adapterB.sendAndReceive(this.hB, "Other analysis: " + rA1.content);
      await this.adapterA.sendAndReceive(this.hA, "Discuss and propose plan.");
      await this.adapterB.sendAndReceive(this.hB, "Discuss and propose plan.");
      this.trans("discussion_complete");
      this.emit("discussion.complete");

      // 3. Plan approval
      const rAp = await this.adapterA.sendAndReceive(this.hA, "Approve plan? plan_approved or plan_rejected.");
      const rBp = await this.adapterB.sendAndReceive(this.hB, "Approve plan? plan_approved or plan_rejected.");
      this.trans("plan_submitted");
      if (rAp.kind !== "plan_approved" || rBp.kind !== "plan_approved") {
        this.trans("plan_rejected"); this.emit("plan.rejected"); return this.result("timeout");
      }
      this.trans("plan_approved");
      this.emit("plan.approved");

      // 4. Builder/Reviewer loop
      const roles = this.manager.getRoles(this.sid);
      let builder = roles[0]!.role === "Builder" ? this.adapterA : this.adapterB;
      let builderH = builder === this.adapterA ? this.hA : this.hB;
      let reviewer = builder === this.adapterA ? this.adapterB : this.adapterA;
      let reviewerH = reviewer === this.adapterA ? this.hA : this.hB;
      let isFirstRound = true;

      for (let round = 0; round < (this.config.maxRounds ?? 3); round++) {
        if (isFirstRound) {
          isFirstRound = false;
          // Already in IMPLEMENTING after plan_approved
        } else {
          this.trans("implementation_started");
        }
        this.emit("round.started", { round: round + 1, builder: builder.id, reviewer: reviewer.id });
        await builder.sendAndReceive(builderH!, "Implement the plan.");
        this.trans("implementation_completed");

        this.emit("review.started");
        const rev = await reviewer.sendAndReceive(reviewerH!, "Review. reply review_approved or finding.");
        this.trans("review_completed");

        if (rev.kind === "review_approved") {
          this.trans("verification_passed");
          const fA = await this.adapterA.sendAndReceive(this.hA!, "Final approval? final_approved.");
          const fB = await this.adapterB.sendAndReceive(this.hB!, "Final approval? final_approved.");
          if (fA.kind === "final_approved" && fB.kind === "final_approved") {
            this.trans("final_review_passed"); this.trans("consensus_reached");
            this.emit("consensus.reached"); return this.result("consensus");
          }
          this.trans("role_switched");
        } else {
          this.trans("findings_presented"); this.emit("findings.presented"); this.trans("findings_resolved"); this.trans("verification_passed");
          this.trans("role_switched");
        }
        [builder, reviewer] = [reviewer, builder];
        [builderH, reviewerH] = [reviewerH, builderH];
      }
      this.trans("final_review_passed"); this.trans("consensus_reached");
      return this.result("consensus");
    } catch (error) {
      this.emit("error", { error: String(error) });
      return this.result("error");
    } finally {
      if (this.hA) await this.adapterA.terminate(this.hA).catch(() => {});
      if (this.hB) await this.adapterB.terminate(this.hB).catch(() => {});
    }
  }

  private trans(event: string) { this.manager.transition(this.sid, event as any); }
  private emit(type: string, data?: Record<string, unknown>) {
    this.events.push({ type, state: this.manager.getState(this.sid), data, timestamp: new Date().toISOString() });
  }
  private result(outcome: OrchestratorResult["outcome"]): OrchestratorResult {
    return { state: this.manager.getState(this.sid), outcome, rounds: this.events.filter(e => e.type === "round.started").length, events: [...this.events] };
  }
}
