import { describe, it, expect } from "vitest";
import { OutputBuffer } from "./stream.js";

describe("OutputBuffer", () => {
  it("starts empty", () => {
    const buf = new OutputBuffer();
    expect(buf.getAll()).toBe("");
    expect(buf.getLast(10)).toBe("");
    expect(buf.contains("anything")).toBe(false);
  });

  it("appends and retrieves data", () => {
    const buf = new OutputBuffer();
    buf.append("hello ");
    buf.append("world");
    expect(buf.getAll()).toBe("hello world");
  });

  it("getLast returns last n characters", () => {
    const buf = new OutputBuffer();
    buf.append("abcdefghij");
    expect(buf.getLast(3)).toBe("hij");
    expect(buf.getLast(10)).toBe("abcdefghij");
    expect(buf.getLast(20)).toBe("abcdefghij");
  });

  it("contains checks for substring", () => {
    const buf = new OutputBuffer();
    buf.append("hello world");
    expect(buf.contains("world")).toBe(true);
    expect(buf.contains("hello")).toBe(true);
    expect(buf.contains("xyz")).toBe(false);
  });

  it("contains checks for regex", () => {
    const buf = new OutputBuffer();
    buf.append("error: something failed");
    expect(buf.contains(/error/)).toBe(true);
    expect(buf.contains(/failed$/)).toBe(true);
    expect(buf.contains(/^warn/)).toBe(false);
  });

  it("clear empties the buffer", () => {
    const buf = new OutputBuffer();
    buf.append("data");
    buf.clear();
    expect(buf.getAll()).toBe("");
    expect(buf.contains("data")).toBe(false);
  });
});
