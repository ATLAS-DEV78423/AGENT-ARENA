// tsc does not copy .mjs files, but the adapters resolve their relay scripts
// relative to __dirname at runtime (dist/<provider>/...). Copy each relay next
// to its compiled adapter so the built package works standalone.
import { cpSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

for (const dir of readdirSync("src")) {
  const srcDir = join("src", dir);
  if (!statSync(srcDir).isDirectory()) continue;
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".mjs"))) {
    cpSync(join(srcDir, file), join("dist", dir, file));
  }
}