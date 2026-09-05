import { describe, expect, it } from "vitest";
import { resolveModelTimeouts } from "./timeouts";

describe("resolveModelTimeouts — per-model call budgets from ARENA_TIMEOUTS", () => {
  it("falls back to the shared defaults when the map is unset", () => {
    expect(resolveModelTimeouts("opencode/nemotron-3.5-lightning-free", undefined)).toEqual({
      steadyMs: 120_000,
      firstCallMs: 300_000,
    });
  });

  it("matches a full provider/model key with steady:first", () => {
    const raw = "opencode/nemotron-3.5-lightning-free=180000:360000";
    expect(resolveModelTimeouts("opencode/nemotron-3.5-lightning-free", raw)).toEqual({
      steadyMs: 180_000,
      firstCallMs: 360_000,
    });
  });

  it("matches by short model name too", () => {
    const raw = "mimo-v2.5-free=240000";
    expect(resolveModelTimeouts("opencode/mimo-v2.5-free", raw)).toEqual({
      steadyMs: 240_000,
      firstCallMs: 300_000, // steady-only entry leaves the first-call default
    });
  });

  it("ignores entries for other models", () => {
    const raw = "some-other-model=240000:480000";
    expect(resolveModelTimeouts("opencode/mimo-v2.5-free", raw)).toEqual({
      steadyMs: 120_000,
      firstCallMs: 300_000,
    });
  });

  it("skips malformed entries and keeps defaults", () => {
    const raw = "garbage,=123,model==,x=abc:900000,ok-model=111000:222000";
    expect(resolveModelTimeouts("opencode/ok-model", raw)).toEqual({
      steadyMs: 111_000,
      firstCallMs: 222_000,
    });
    expect(resolveModelTimeouts("opencode/x", raw)).toEqual({
      steadyMs: 120_000,
      firstCallMs: 300_000,
    });
  });
});
