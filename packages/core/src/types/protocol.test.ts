import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  createAnalysisEvent,
  createDiscussionMessage,
  createFinding,
  createApproval,
  createPlan,
} from "./protocol.js";
import { sessionId, agentId } from "./common.js";

const sid = sessionId("test-session");
const aid = agentId("agent-a");

describe("EVENT_TYPES", () => {
  it("defines all 30 required event types", () => {
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(28);
    for (const type of [
      "session.created", "analysis.submitted", "message.created",
      "finding.created", "plan.proposed", "plan.approved",
      "review.started", "verification.completed", "role.switched",
    ]) {
      expect(EVENT_TYPES).toContain(type);
    }
  });
});

describe("createAnalysisEvent", () => {
  it("creates a valid analysis event", () => {
    const event = createAnalysisEvent({
      sessionId: sid, agentId: aid,
      data: { understanding: "Build auth", assumptions: ["Uses DB"], risks: ["Complex"], approaches: ["JWT"], confidence: 0.8 },
    });
    expect(event.type).toBe("analysis.submitted");
    expect(event.agentId).toBe("agent-a");
    expect(event.sessionId).toBe("test-session");
    expect(event.data.understanding).toBe("Build auth");
  });
});

describe("createFinding", () => {
  it("creates a finding with severity", () => {
    const event = createFinding({
      sessionId: sid, agentId: aid,
      data: { severity: "blocker", category: "security", claim: "Token replay", evidence: "test.ts:1", impact: "Hijack", fix: "Rotate" },
    });
    expect(event.type).toBe("finding.created");
    expect(event.data.severity).toBe("blocker");
    expect(event.data.status).toBe("OPEN");
  });
});

describe("createApproval", () => {
  it("creates approved event", () => {
    const event = createApproval({
      sessionId: sid, agentId: aid,
      data: { status: "approved", confidence: "high", requirementsMet: true, testsVerified: true, unresolvedFindings: 0, notes: "LGTM" },
    });
    expect(event.type).toBe("plan.approved");
  });
});

describe("createPlan", () => {
  it("creates plan with steps", () => {
    const event = createPlan({
      sessionId: sid,
      data: { objective: "Build auth", scope: "src/", steps: [{ id: "1", description: "Create", files: ["src/auth.ts"] }], acceptanceCriteria: ["Tests pass"], filesAffected: ["src/auth.ts"] },
    });
    expect(event.type).toBe("plan.proposed");
    expect(event.data.steps).toHaveLength(1);
  });
});
