import { describe, it, expect } from "vitest";
import { SecretRedactor } from "./secret-redactor.js";

describe("SecretRedactor", () => {
  it("redacts API keys", () => {
    const redactor = new SecretRedactor();
    const input = "Using key sk-abc123def456ghi789jkl012mno to authenticate";
    const result = redactor.redact(input);
    expect(result).not.toContain("sk-abc123def456ghi789jkl012mno");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts AWS access keys", () => {
    const redactor = new SecretRedactor();
    const input = "AKIAIOSFODNN7EXAMPLE";
    const result = redactor.redact(input);
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts GitHub personal access tokens", () => {
    const redactor = new SecretRedactor();
    const input = "Token: ghp_1234567890abcdef1234567890abcdef1234";
    const result = redactor.redact(input);
    expect(result).not.toContain("ghp_1234567890abcdef");
  });

  it("does not redact non-secret strings", () => {
    const redactor = new SecretRedactor();
    const input = "The variable name is API_KEY but no value";
    const result = redactor.redact(input);
    expect(result).toBe(input);
  });

  it("allows custom patterns", () => {
    const redactor = new SecretRedactor();
    redactor.addPattern(/CUSTOM_TOKEN_\w+/g);
    const input = "Token: CUSTOM_TOKEN_abc123";
    const result = redactor.redact(input);
    expect(result).not.toContain("CUSTOM_TOKEN_abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts multiple secrets in one string", () => {
    const redactor = new SecretRedactor();
    const input = "key1=sk-aaa111bbb222ccc333ddd444eee555 key2=sk-fff666ggg777hhh888iii999jjj000";
    const result = redactor.redact(input);
    expect(result).not.toContain("sk-aaa111bbb222ccc333ddd444eee555");
    expect(result).not.toContain("sk-fff666ggg777hhh888iii999jjj000");
  });
});
