import { describe, it, expect } from "vitest";
import { createDelimiter, findDelimiter, stripDelimiters } from "./delimiter.js";

describe("createDelimiter", () => {
  it("returns a pair of start and end strings", () => {
    const d = createDelimiter();
    expect(typeof d.start).toBe("string");
    expect(typeof d.end).toBe("string");
    expect(d.start).not.toBe(d.end);
  });

  it("start and end are unique across calls", () => {
    const d1 = createDelimiter();
    const d2 = createDelimiter();
    expect(d1.start).not.toBe(d2.start);
  });
});

describe("findDelimiter", () => {
  it("finds end delimiter in output", () => {
    const d = createDelimiter();
    const output = `some output\n${d.end}\nmore stuff`;
    expect(findDelimiter(output, d.end)).toBe(true);
  });

  it("returns false when delimiter not present", () => {
    const d = createDelimiter();
    expect(findDelimiter("no delimiter here", d.end)).toBe(false);
  });

  it("is case-sensitive", () => {
    const d = createDelimiter();
    expect(findDelimiter(d.end.toUpperCase(), d.end)).toBe(false);
  });
});

describe("stripDelimiters", () => {
  it("removes delimiters from output", () => {
    const d = createDelimiter();
    const output = `${d.start}\nhello world\n${d.end}\ntrailing`;
    const result = stripDelimiters(output, d);
    expect(result).toBe("hello world\n\ntrailing");
  });

  it("returns original when no delimiters found", () => {
    const d = createDelimiter();
    expect(stripDelimiters("plain text", d)).toBe("plain text");
  });

  it("handles multiple start delimiters (keeps first occurrence)", () => {
    const d = createDelimiter();
    const output = `${d.start}first\n${d.start}second\n${d.end}`;
    const result = stripDelimiters(output, d);
    expect(result).toContain("first");
    expect(result).toContain("second");
  });
});
