import pino from "pino";
export type Logger = pino.Logger;
export function createLogger(opts: { component: string; level?: string }): Logger {
  return pino({ name: opts.component, level: opts.level ?? "info",
    transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined });
}
