import { describe, it, expect } from "vitest";
import { WorkspaceDetector } from "./detector.js";

describe("WorkspaceDetector", () => {
  it("detects current git repo", async () => {
    const detector = new WorkspaceDetector(process.cwd());
    const info = await detector.detect();
    expect(info.isGitRepo).toBe(true);
    expect(info.root).toBeTruthy();
    expect(info.cwd).toBe(process.cwd());
    expect(typeof info.branch === "string" || info.branch === null).toBe(true);
    expect(typeof info.isDirty).toBe("boolean");
  });

  it("isWithinWorkspace allows paths inside workspace", () => {
    const detector = new WorkspaceDetector(process.cwd());
    expect(detector.isWithinWorkspace("src/index.ts")).toBe(true);
    expect(detector.isWithinWorkspace(".")).toBe(true);
    expect(detector.isWithinWorkspace("packages/core")).toBe(true);
  });

  it("isWithinWorkspace rejects paths outside workspace", () => {
    const detector = new WorkspaceDetector(process.cwd());
    expect(detector.isWithinWorkspace("../outside")).toBe(false);
  });

  it("handles non-git directory gracefully", async () => {
    const detector = new WorkspaceDetector("C:\\");
    const info = await detector.detect();
    expect(info.isGitRepo).toBe(false);
    expect(info.branch).toBeNull();
    expect(info.isDirty).toBe(false);
  });
});
