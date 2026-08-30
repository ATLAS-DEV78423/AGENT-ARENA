import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLogger } from "./index.js";

describe("createLogger", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it("creates a logger with component name", () => {
    const logger = createLogger({ component: "test" });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("creates logger with custom level", () => {
    const logger = createLogger({ component: "test", level: "debug" });
    expect(logger).toBeDefined();
  });

  it("defaults to info level", () => {
    const logger = createLogger({ component: "test" });
    expect(logger.level).toBe("info");
  });

  it("respects custom level", () => {
    const logger = createLogger({ component: "test", level: "error" });
    expect(logger.level).toBe("error");
  });

  it("can log without throwing", () => {
    const logger = createLogger({ component: "test" });
    expect(() => {
      logger.info("test message");
      logger.warn("warning message");
      logger.error("error message");
      logger.debug("debug message");
    }).not.toThrow();
  });
});
