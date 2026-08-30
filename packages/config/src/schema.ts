import { z } from "zod";

export const ArenaConfigSchema = z.object({
  agents: z.array(z.object({ id: z.string(), command: z.string(), args: z.array(z.string()).default([]) })).default([]),
  debate: z.object({
    maxRounds: z.number().int().min(1).max(20).default(5),
    maxMinutes: z.number().min(1).max(120).default(20),
    maxRepeatedObjections: z.number().int().min(1).max(10).default(2),
  }).default({}),
  verification: z.object({ runTests: z.boolean().default(true), requireCleanReview: z.boolean().default(true) }).default({}),
  workspace: z.object({ strategy: z.enum(["direct", "worktree", "copy"]).default("worktree") }).default({}),
  security: z.object({ profile: z.enum(["inherit", "restricted", "isolated"]).default("inherit") }).default({}),
  logging: z.object({ level: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info") }).default({}),
});
export type ArenaConfig = z.infer<typeof ArenaConfigSchema>;
export const DEFAULT_CONFIG = ArenaConfigSchema.parse({});
