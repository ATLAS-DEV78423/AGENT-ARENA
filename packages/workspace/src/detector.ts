import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

export interface WorkspaceInfo { root: string; cwd: string; isGitRepo: boolean; branch: string | null; isDirty: boolean; }

export class WorkspaceDetector {
  private cwd: string;
  constructor(cwd: string) { this.cwd = resolve(cwd); }
  async detect(): Promise<WorkspaceInfo> {
    const root = this.findGitRoot();
    if (!root) return { root: this.cwd, cwd: this.cwd, isGitRepo: false, branch: null, isDirty: false };
    const branch = this.getBranch(root);
    const status = this.getGitStatus(root);
    return { root, cwd: this.cwd, isGitRepo: true, branch, isDirty: status.length > 0 };
  }
  isWithinWorkspace(target: string): boolean {
    const resolved = resolve(this.cwd, target);
    const rel = relative(this.cwd, resolved);
    return !rel.startsWith("..") && !isAbsolute(target.replace(/^[A-Z]:/, ""));
  }
  private findGitRoot(): string | null {
    try { const r = execSync("git rev-parse --show-toplevel", { encoding: "utf-8", timeout: 5000, cwd: this.cwd }).trim(); return existsSync(r) ? r : null; } catch { return null; }
  }
  private getBranch(root: string): string | null { try { return execSync("git branch --show-current", { encoding: "utf-8", timeout: 5000, cwd: root }).trim(); } catch { return null; } }
  private getGitStatus(root: string): string[] { try { const o = execSync("git status --porcelain", { encoding: "utf-8", timeout: 5000, cwd: root }).trim(); return o ? o.split("\n") : []; } catch { return []; } }
}
