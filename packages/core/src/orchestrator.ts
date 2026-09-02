import { SessionId, AgentId, Timestamp, now } from "./types/common.js";
import { ArenaState } from "./types/state-machine.js";
import { SessionManager } from "./session/manager.js";
import { FindingManager } from "./session/finding-manager.js";
import { DeadlockDetector } from "./session/deadlock-detector.js";
import { FindingSeverity, CreateFindingParams } from "./types/finding.js";
import { EventStore } from "./persistence/event-store.js";
import {
  analysisPrompt,
  discussionPrompt,
  planApprovalPrompt,
  buildPrompt,
  reviewPrompt,
  fixPrompt,
  finalApprovalPrompt,
} from "./prompts.js";
import { VerificationEngine } from "@arena/verification";
import { SecurityGuard } from "@arena/policy";

export type AgentResponseKind =
  | "analysis"
  | "message"
  | "plan_approved"
  | "plan_rejected"
  | "finding"
  | "review_approved"
  | "review_rejected"
  | "final_approved"
  | "final_rejected"
  | "error"
  | "timeout"
  | "crash";

export interface AgentResponse {
  kind: AgentResponseKind;
  content: string;
  data?: Record<string, unknown>;
}

export interface OrchestratorConfig {
  task: string;
  cwd: string;
  maxRounds?: number;
  maxMinutes?: number;
  maxRepeatedObjections?: number;
  verification?: {
    commands: Array<{ name: string; cmd: string; args?: string[]; timeoutMs?: number }>;
  };
  security?: {
    profile: "inherit" | "restricted" | "isolated";
  };
  onLog?: (msg: string) => void;
}

export interface OrchestratorEvent {
  type: string;
  state: ArenaState;
  agentId?: AgentId;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface OrchestratorResult {
  sessionId: SessionId;
  state: ArenaState;
  outcome: "consensus" | "timeout" | "error";
  rounds: number;
  events: OrchestratorEvent[];
}

export interface OrchestratorAdapter {
  id: AgentId;
  name: string;
  start(config: { task: string; cwd: string }): Promise<{
    sessionId: string;
    pid: number;
  }>;
  sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse>;
  terminate(handle: { sessionId: string }): Promise<void>;
}

function parseFindingFromResponse(
  content: string,
  agentId: AgentId,
): CreateFindingParams {
  const lower = content.toLowerCase();
  let severity: FindingSeverity = "major";
  if (/\b(blocker|critical|showstopper|severe)\b/.test(lower))
    severity = "blocker";
  else if (/\b(minor|cosmetic|style|nit)\b/.test(lower)) severity = "minor";
  else if (/\b(note|info|fyi)\b/.test(lower)) severity = "note";

  return {
    severity,
    category: "general",
    claim: content,
    evidence: "",
    impact: "",
    fix: "",
    createdBy: agentId,
  };
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private adapterA: OrchestratorAdapter;
  private adapterB: OrchestratorAdapter;
  private manager: SessionManager;
  private eventStore: EventStore | null;
  private findingManager: FindingManager;
  private deadlockDetector: DeadlockDetector;
  private verificationEngine: VerificationEngine | null;
  private securityGuard: SecurityGuard | null;
  private events: OrchestratorEvent[] = [];
  private hA: { sessionId: string } | null = null;
  private hB: { sessionId: string } | null = null;
  private sid!: SessionId;

  constructor(
    config: OrchestratorConfig,
    a: OrchestratorAdapter,
    b: OrchestratorAdapter,
    mgr?: SessionManager,
    eventStore?: EventStore,
  ) {
    this.config = config;
    this.adapterA = a;
    this.adapterB = b;
    this.manager = mgr ?? new SessionManager();
    this.eventStore = eventStore ?? null;
    this.findingManager = new FindingManager();
    this.deadlockDetector = new DeadlockDetector(
      this.config.maxRepeatedObjections ?? 2,
    );
    this.verificationEngine = config.verification
      ? new VerificationEngine()
      : null;
    this.securityGuard = config.security
      ? new SecurityGuard({ profile: config.security.profile, cwd: config.cwd })
      : null;
  }

  async run(): Promise<OrchestratorResult> {
    try {
      const s = await this.manager.createSession({
        task: this.config.task,
        agentA: this.adapterA.id,
        agentB: this.adapterB.id,
        budget: {
          maxRounds: this.config.maxRounds ?? 3,
          maxMinutes: this.config.maxMinutes ?? 10,
        },
      });
      this.sid = s.id;

      this.emit("session.created");
      this.trans("initialize");
      this.emit("session.initialized");

      this.hA = await this.adapterA.start({
        task: this.config.task,
        cwd: this.config.cwd,
      });
      this.hB = await this.adapterB.start({
        task: this.config.task,
        cwd: this.config.cwd,
      });
      this.trans("environment_checked");
      this.emit("environment.checked");
      this.log("Both agents launched.");

      // 1. Independent analysis
      this.log("Agent A analyzing...");
      const rA1 = await this.adapterA.sendAndReceive(
        this.hA,
        analysisPrompt(this.config.task),
      );
      this.log("Agent B analyzing...");
      const rB1 = await this.adapterB.sendAndReceive(
        this.hB,
        analysisPrompt(this.config.task),
      );
      this.trans("analysis_complete");
      this.emit("analysis.started");
      this.trans("analysis_complete");
      this.emit("analysis.complete", {
        agentA: rA1.content,
        agentB: rB1.content,
      });
      this.log("Analysis complete. Starting discussion...");

      // 2. Discussion — structured events
      const discA = await this.adapterA.sendAndReceive(
        this.hA,
        discussionPrompt(rB1.content),
      );
      this.emit(
        "message.created",
        { messageType: "DISCUSSION", content: discA.content },
        this.adapterA.id,
      );

      const discB = await this.adapterB.sendAndReceive(
        this.hB,
        discussionPrompt(rA1.content),
      );
      this.emit(
        "message.created",
        { messageType: "DISCUSSION", content: discB.content },
        this.adapterB.id,
      );

      // Record discussion-phase objections for deadlock detection
      if (discA.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterA.id,
          claim: discA.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }
      if (discB.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterB.id,
          claim: discB.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }

      this.trans("discussion_complete");
      this.emit("discussion.complete");
      this.log("Discussion complete. Requesting plan approval...");

      // 3. Plan approval
      const planText = discA.kind === "plan_approved" ? discA.content : discB.content;
      const rAp = await this.adapterA.sendAndReceive(
        this.hA,
        planApprovalPrompt(planText),
      );
      const rBp = await this.adapterB.sendAndReceive(
        this.hB,
        planApprovalPrompt(planText),
      );
      this.trans("plan_submitted");

      if (rAp.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterA.id,
          claim: rAp.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }
      if (rBp.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterB.id,
          claim: rBp.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }

      if (this.deadlockDetector.isDeadlock()) {
        this.emit("dispute.opened", {
          reason: "Repeated objections without resolution",
        });
        this.log("Deadlock detected — escalating to user.");
        this.trans("plan_rejected");
        return this.result("timeout");
      }

      if (rAp.kind !== "plan_approved" || rBp.kind !== "plan_approved") {
        this.trans("plan_rejected");
        this.emit("plan.rejected");
        return this.result("timeout");
      }
      this.trans("plan_approved");
      this.emit("plan.approved");
      this.log("Plan approved! Starting build/review loop...");

      // 4. Builder/Reviewer loop
      const roles = this.manager.getRoles(this.sid);
      let builder =
        roles[0]!.role === "Builder" ? this.adapterA : this.adapterB;
      let builderH = builder === this.adapterA ? this.hA : this.hB;
      let reviewer =
        builder === this.adapterA ? this.adapterB : this.adapterA;
      let reviewerH = reviewer === this.adapterA ? this.hA : this.hB;
      let isFirstRound = true;

      for (
        let round = 0;
        round < (this.config.maxRounds ?? 3);
        round++
      ) {
        if (isFirstRound) {
          isFirstRound = false;
        } else {
          this.trans("implementation_started");
        }
        this.emit("round.started", {
          round: round + 1,
          builder: builder.id,
          reviewer: reviewer.id,
        });
        await builder.sendAndReceive(
          builderH!,
          buildPrompt(this.config.task, planText),
        );
        this.trans("implementation_completed");

        // Run verification if configured
        let verificationResults: string | undefined;
        if (this.verificationEngine && this.config.verification) {
          this.log("Running verification...");
          const vResult = await this.verificationEngine.verify(
            this.config.cwd,
            { commands: this.config.verification.commands },
          );
          verificationResults = vResult.checks
            .map(
              (c) =>
                `${c.name}: ${c.passed ? "PASSED" : "FAILED"}${c.stdout ? "\n" + c.stdout.slice(0, 500) : ""}`,
            )
            .join("\n");
          this.emit("verification.completed", {
            passed: vResult.passed,
            checks: vResult.checks.length,
          });
          this.log(
            `Verification: ${vResult.passed ? "PASSED" : "FAILED"} (${vResult.checks.length} checks)`,
          );
        }

        this.emit("review.started", undefined, reviewer.id);
        const rev = await reviewer.sendAndReceive(
          reviewerH!,
          reviewPrompt(this.config.task, verificationResults),
        );

        if (rev.kind === "review_approved") {
          this.trans("review_completed");
          this.trans("verification_passed");

          const fA = await this.adapterA.sendAndReceive(
            this.hA!,
            finalApprovalPrompt(),
          );
          const fB = await this.adapterB.sendAndReceive(
            this.hB!,
            finalApprovalPrompt(),
          );
          if (
            fA.kind === "final_approved" && fB.kind === "final_approved"
          ) {
            this.trans("final_review_passed");
            this.trans("consensus_reached");
            this.emit("consensus.reached");
            return this.result("consensus");
          }
          // Not final — continue to next round
          this.trans("implementation_started");
        } else {
          // findings_presented from REVIEWING → REVISING (not review_completed first)
          this.trans("findings_presented");

          const finding = this.findingManager.create(
            parseFindingFromResponse(rev.content, reviewer.id),
          );
          this.emit(
            "finding.created",
            {
              findingId: finding.id,
              severity: finding.severity,
              claim: finding.claim,
            },
            reviewer.id,
          );
          this.log(
            "Reviewer found: " +
              finding.severity +
              " — " +
              finding.claim.slice(0, 100),
          );

          // Builder resolves findings
          await builder.sendAndReceive(
            builderH!,
            fixPrompt(rev.content),
          );
          this.findingManager.transition(finding.id, "acknowledge");
          this.findingManager.transition(finding.id, "accept");
          this.findingManager.transition(finding.id, "fix");

          this.trans("findings_resolved");
          this.trans("verification_passed");
          if (round < (this.config.maxRounds ?? 3) - 1) {
            this.trans("implementation_started");
          }
        }

        [builder, reviewer] = [reviewer, builder];
        [builderH, reviewerH] = [reviewerH, builderH];
      }

      this.trans("final_review_passed");
      this.trans("consensus_reached");
      return this.result("consensus");
    } catch (error) {
      this.emit("error", { error: String(error) });
      this.log("ERROR: " + String(error));
      return this.result("error");
    } finally {
      if (this.hA) await this.adapterA.terminate(this.hA).catch(() => {});
      if (this.hB) await this.adapterB.terminate(this.hB).catch(() => {});
    }
  }

  private trans(event: string) {
    this.manager.transition(this.sid, event as any);
  }

  private emit(
    type: string,
    data?: Record<string, unknown>,
    agentId?: AgentId,
  ) {
    const ts = now();
    const event: OrchestratorEvent = {
      type,
      state: this.manager.getState(this.sid),
      agentId,
      data,
      timestamp: ts,
    };
    this.events.push(event);
    if (this.eventStore) {
      const redactedData = this.securityGuard && event.data
        ? this.redactData(event.data)
        : event.data;
      this.eventStore.append(this.sid as string, {
        type: event.type,
        state: event.state,
        timestamp: ts,
        agentId: event.agentId as string | undefined,
        data: redactedData,
      });
    }
  }

  private result(
    outcome: OrchestratorResult["outcome"],
  ): OrchestratorResult {
    return {
      sessionId: this.sid,
      state: this.manager.getState(this.sid),
      outcome,
      rounds: this.events.filter((e) => e.type === "round.started").length,
      events: [...this.events],
    };
  }

  private log(msg: string) {
    const redacted = this.securityGuard ? this.securityGuard.redactOutput(msg) : msg;
    this.config.onLog?.(redacted);
  }

  private redactData(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        result[key] = this.securityGuard!.redactOutput(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
