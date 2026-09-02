import { describe, it, expect } from "vitest";
import {
  analysisPrompt,
  discussionPrompt,
  planApprovalPrompt,
  buildPrompt,
  reviewPrompt,
  fixPrompt,
  finalApprovalPrompt,
} from "./prompts.js";

const TASK = "Add JWT auth to the API";

describe("prompts", () => {
  describe("analysisPrompt", () => {
    it("returns independent analysis instruction with task", () => {
      const p = analysisPrompt(TASK);
      expect(p).toContain("independently");
      expect(p).toContain(TASK);
    });

    it("does not include other agent's analysis", () => {
      const p = analysisPrompt(TASK);
      expect(p).not.toContain("Other agent");
    });
  });

  describe("discussionPrompt", () => {
    it("includes other agent's analysis", () => {
      const otherAnalysis = "I think we should use bcrypt";
      const p = discussionPrompt(otherAnalysis);
      expect(p).toContain(otherAnalysis);
    });

    it("instructs to propose a plan", () => {
      const p = discussionPrompt("x");
      expect(p.toLowerCase()).toContain("plan");
    });
  });

  describe("planApprovalPrompt", () => {
    it("includes the plan text", () => {
      const plan = "Step 1: Add middleware\nStep 2: Add routes";
      const p = planApprovalPrompt(plan);
      expect(p).toContain(plan);
    });
  });

  describe("buildPrompt", () => {
    it("includes task and instructs implementation", () => {
      const plan = "Implement auth";
      const p = buildPrompt(TASK, plan);
      expect(p).toContain(TASK);
      expect(p).toContain(plan);
      expect(p.toLowerCase()).toContain("implement");
    });
  });

  describe("reviewPrompt", () => {
    it("instructs adversarial review", () => {
      const p = reviewPrompt(TASK);
      expect(p.toLowerCase()).toContain("defect");
    });

    it("mentions evidence", () => {
      const p = reviewPrompt(TASK);
      expect(p.toLowerCase()).toContain("evidence");
    });
  });

  describe("reviewPrompt with verification", () => {
    it("includes verification results when provided", () => {
      const verification = "Tests: 5 passed, 2 failed\nLint: OK";
      const p = reviewPrompt(TASK, verification);
      expect(p).toContain(verification);
    });
  });

  describe("fixPrompt", () => {
    it("includes findings and instructs addressing them", () => {
      const findings = "Bug: null pointer in auth.ts line 42";
      const p = fixPrompt(findings);
      expect(p).toContain(findings);
      expect(p.toLowerCase()).toContain("finding");
    });
  });

  describe("finalApprovalPrompt", () => {
    it("asks for final approval", () => {
      const p = finalApprovalPrompt();
      expect(p.toLowerCase()).toContain("approve");
    });
  });
});
