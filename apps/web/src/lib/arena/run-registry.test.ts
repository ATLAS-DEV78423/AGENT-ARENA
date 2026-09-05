import { describe, expect, it, vi } from "vitest";
import { createRun, getRun, push, subscribe } from "./run-registry";

describe("run registry — a run outlives its POST and late subscribers replay it", () => {
  it("replays every buffered frame to a subscriber that attaches late", async () => {
    const run = createRun("arena-1");
    push(run, "session.mode", { mode: "demo" });
    push(run, "message", { role: "arena", content: "hi" });
    const seen: string[] = [];
    const done = subscribe(run, 0, (f) =>
      seen.push(f.event === "message" ? `message:${f.data.content}` : f.event),
    );
    push(run, "session.completed", { outcome: "consensus" });
    await done;
    expect(seen).toEqual(["session.mode", "message:hi", "session.completed"]);
  });

  it("skips frames a reconnecting client already consumed (after cursor)", async () => {
    const run = createRun("arena-1");
    push(run, "session.mode", { mode: "demo" });
    push(run, "message", { role: "arena", content: "old" });
    push(run, "message", { role: "arena", content: "new" });
    const seen: string[] = [];
    const done = subscribe(run, 2, (f) =>
      seen.push(f.event === "message" ? (f.data.content as string) : f.event),
    );
    push(run, "session.completed", { outcome: "consensus" });
    await done;
    expect(seen).toEqual(["new", "session.completed"]);
  });

  it("delivers live frames after the replay until the terminal frame", async () => {
    const run = createRun("arena-1");
    push(run, "message", { role: "arena", content: "before" });
    const seen: string[] = [];
    const done = subscribe(run, 0, (f) =>
      seen.push(f.event === "message" ? (f.data.content as string) : f.event),
    );
    push(run, "message", { role: "arena", content: "live" });
    push(run, "session.completed", { outcome: "consensus" });
    await done;
    expect(seen).toEqual(["before", "live", "session.completed"]);
  });

  it("marks the run finished on a terminal frame and replays it to late joiners", async () => {
    const run = createRun("arena-1");
    push(run, "session.completed", { outcome: "error" });
    expect(run.finished).toBe(true);
    expect(run.finishedAt).toBeTypeOf("number");
    const seen: string[] = [];
    await subscribe(run, 0, (f) => seen.push(f.event));
    expect(seen).toEqual(["session.completed"]);
  });

  it("a dead subscriber (closed controller) does not kill the run's terminal push", async () => {
    const run = createRun("arena-1");
    // Subscriber A registers on the empty run, then its connection dies (a
    // reload aborted the stream), so its onFrame throws exactly like
    // controller.enqueue on a closed controller when frames arrive.
    const deadDone = subscribe(run, 0, () => {
      throw new Error("Invalid state: Controller is already closed");
    });
    deadDone.catch(() => {});
    await Promise.resolve();
    // Subscriber B: still live, must receive every frame to the terminal.
    const seen: string[] = [];
    const liveDone = subscribe(run, 0, (f) => seen.push(f.event));
    // Pushes must not throw, and no spurious error frame may be appended.
    expect(() => push(run, "session.mode", { mode: "demo" })).not.toThrow();
    expect(() => push(run, "session.completed", { outcome: "consensus" })).not.toThrow();
    await liveDone;
    expect(seen).toEqual(["session.mode", "session.completed"]);
    const frames = (await import("./run-registry")).getRun("arena-1")!.frames;
    expect(frames.map((f) => f.event)).toEqual(["session.mode", "session.completed"]);
    expect(run.finished).toBe(true);
  });

  it("does not resolve a live subscriber before the terminal frame arrives", async () => {
    const run = createRun("arena-1");
    let resolved = false;
    const done = subscribe(run, 0, () => {}).then(() => (resolved = true));
    push(run, "message", { role: "arena", content: "still going" });
    await Promise.resolve();
    expect(resolved).toBe(false);
    push(run, "error", { message: "boom" });
    await done;
    expect(resolved).toBe(true);
  });

  it("evicts finished runs once the reconnect window passes and 404s afterwards", async () => {
    vi.useFakeTimers();
    try {
      const run = createRun("arena-1");
      push(run, "session.completed", { outcome: "consensus" });
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(getRun("arena-1")).toBeUndefined();
      expect(getRun("never-started")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
