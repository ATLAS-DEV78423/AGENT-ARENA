import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface Worktree {
  path: string;
  branch: string;
}

// Git records the real (long, correctly-cased) path; on Windows os.tmpdir()
// can be the 8.3 short form (RUNNER~1) and on macOS /var symlinks to
// /private/var — canonicalize so worktree paths match what git reports.
function canonicalTmp(): string {
  try {
    return realpathSync(tmpdir());
  } catch {
    return tmpdir();
  }
}

export class WorktreeManager {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = resolve(repoRoot);
  }

  create(agentId: string): Worktree {
    const branch = `arena/${agentId}-${Date.now()}`;
    const worktreePath = mkdtempSync(join(canonicalTmp(), `arena-wt-${agentId}-`));

    execFileSync("git", ["worktree", "add", worktreePath, "-b", branch], {
      cwd: this.repoRoot,
      stdio: "ignore",
      timeout: 10_000,
    });

    return { path: worktreePath, branch };
  }

  cleanup(wt: Worktree): void {
    try {
      execFileSync("git", ["worktree", "remove", wt.path, "--force"], {
        cwd: this.repoRoot,
        stdio: "ignore",
        timeout: 10_000,
      });
    } catch {
      // Force remove if git worktree remove fails
      rmSync(wt.path, { recursive: true, force: true });
    }
  }
}
