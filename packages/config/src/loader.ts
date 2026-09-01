import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { ArenaConfigSchema, DEFAULT_CONFIG, ArenaConfig } from "./schema.js";

export async function loadConfig(cwd: string): Promise<ArenaConfig> {
  const arenaDir = join(cwd, ".arena");

  // Try .arena/config.yaml first, then .arena/config.json
  const yamlPath = join(arenaDir, "config.yaml");
  const jsonPath = join(arenaDir, "config.json");

  let raw: Record<string, unknown> | null = null;

  if (existsSync(yamlPath)) {
    const content = readFileSync(yamlPath, "utf-8");
    raw = parseYaml(content) as Record<string, unknown>;
  } else if (existsSync(jsonPath)) {
    const content = readFileSync(jsonPath, "utf-8");
    raw = JSON.parse(content) as Record<string, unknown>;
  }

  if (raw === null) {
    return DEFAULT_CONFIG;
  }

  // Validate through Zod schema — throws on invalid config
  return ArenaConfigSchema.parse(raw);
}
