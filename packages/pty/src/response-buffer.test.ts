import { describe, it, expect, beforeEach } from "vitest";
import { ResponseBuffer } from "./response-buffer.js";
import { createDelimiter } from "./delimiter.js";

describe("ResponseBuffer", () => {
  let buf: ResponseBuffer;
  let delim: ReturnType<typeof createDelimiter>;

  beforeEach(() => {
    delim = createDelimiter();
    buf = new ResponseBuffer(delim);
  });

  it("starts empty", () => {
    expect(buf.getRaw()).toBe("");
    expect(buf.hasCompleteResponse()).toBe(false);
  });

  it("accumulates output", () => {
    buf.append("hello ");
    buf.append("world");
    expect(buf.getRaw()).toBe("hello world");
  });

  it("detects complete response when two end delimiters arrive", () => {
    buf.append(`${delim.end}\nsome output\n`);
    expect(buf.hasCompleteResponse()).toBe(false);
    buf.append(`${delim.end}\n`);
    expect(buf.hasCompleteResponse()).toBe(true);
  });

  it("consumeResponse returns content without delimiters", () => {
    buf.append(`${delim.start}\nresult data\n${delim.end}\n`);
    const response = buf.consumeResponse();
    expect(response).toBe("result data");
    expect(buf.hasCompleteResponse()).toBe(false);
  });

  it("consumeResponse clears the buffer", () => {
    buf.append(`${delim.start}\ndata\n${delim.end}\ntrailing`);
    buf.consumeResponse();
    expect(buf.getRaw()).toBe("trailing");
  });

  it("handles partial delimiter across chunks", () => {
    const partial = delim.end.slice(0, 5);
    buf.append(`${delim.end}\ndata\n${partial}`);
    expect(buf.hasCompleteResponse()).toBe(false);
    buf.append(`${delim.end.slice(5)}\n`);
    expect(buf.hasCompleteResponse()).toBe(true);
  });

  it("clear resets everything", () => {
    buf.append("data");
    buf.clear();
    expect(buf.getRaw()).toBe("");
    expect(buf.hasCompleteResponse()).toBe(false);
  });
});
