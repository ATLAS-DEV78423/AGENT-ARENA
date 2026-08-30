import { describe, it, expect } from "vitest";
import { PathValidator } from "./path-validator.js";

describe("PathValidator", () => {
  const validator = new PathValidator("/workspace");

  it("allows valid relative paths", () => {
    expect(validator.isValid("src/index.ts")).toBe(true);
    expect(validator.isValid("packages/core/src/index.ts")).toBe(true);
    expect(validator.isValid(".")).toBe(true);
  });

  it("rejects absolute paths", () => {
    expect(validator.isValid("/etc/passwd")).toBe(false);
    expect(validator.isValid("/workspace/src/index.ts")).toBe(false);
  });

  it("rejects paths with null bytes", () => {
    expect(validator.isValid("src/index.ts\0/etc/passwd")).toBe(false);
  });

  it("rejects paths that escape workspace", () => {
    expect(validator.isValid("../etc/passwd")).toBe(false);
    expect(validator.isValid("src/../../etc/passwd")).toBe(false);
  });

  it("sanitize returns normalized valid path", () => {
    const result = validator.sanitize("src/index.ts");
    expect(result).toBeTruthy();
    expect(result).toMatch(/src[/\\]index\.ts/);
  });

  it("sanitize returns null for invalid path", () => {
    expect(validator.sanitize("../etc/passwd")).toBeNull();
    expect(validator.sanitize("/etc/passwd")).toBeNull();
  });

  it("assertValid throws on invalid path", () => {
    expect(() => validator.assertValid("../etc/passwd")).toThrow("Path escapes workspace");
    expect(() => validator.assertValid("/etc/passwd")).toThrow("Path escapes workspace");
  });

  it("assertValid does not throw on valid path", () => {
    expect(() => validator.assertValid("src/index.ts")).not.toThrow();
  });

  it("handles dot segments correctly", () => {
    expect(validator.isValid("src/./index.ts")).toBe(true);
    expect(validator.isValid("src/../src/index.ts")).toBe(true);
  });
});
