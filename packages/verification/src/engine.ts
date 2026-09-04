import { execFile } from "node:child_process";

export interface VerificationCommand {
  name: string;
  cmd: string;
  args?: string[];
  timeoutMs?: number;
}

export interface VerificationConfig {
  commands: VerificationCommand[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  error?: string;
  durationMs: number;
}

export interface VerificationResult {
  passed: boolean;
  checks: CheckResult[];
  durationMs: number;
}

export class VerificationEngine {
  async verify(cwd: string, config: VerificationConfig): Promise<VerificationResult> {
    const start = Date.now();
    const checks: CheckResult[] = [];

    for (const cmd of config.commands) {
      const check = await this.runCommand(cwd, cmd);
      checks.push(check);
    }

    return {
      passed: checks.every(c => c.passed),
      checks,
      durationMs: Date.now() - start,
    };
  }

  private runCommand(cwd: string, cmd: VerificationCommand): Promise<CheckResult> {
    const start = Date.now();
    return new Promise((resolve) => {
      // On win32, global package-manager shims (pnpm, yarn) are .cmd files —
      // execFile(name) ENOENTs on them. Routing through cmd /c resolves the
      // shim while keeping stdout/stderr as separate pipes (unlike
      // shell:true, which merges them). Args are our own config strings, not
      // agent output, so there is no injection surface.
      const isWin = process.platform === "win32";
      const child = isWin
        ? execFile("cmd", ["/c", cmd.cmd, ...(cmd.args ?? [])], {
            cwd,
            timeout: cmd.timeoutMs ?? 30_000,
            maxBuffer: 1024 * 1024,
          })
        : execFile(cmd.cmd, cmd.args ?? [], {
            cwd,
            timeout: cmd.timeoutMs ?? 30_000,
            maxBuffer: 1024 * 1024,
          });

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code, signal) => {
        resolve({
          name: cmd.name,
          passed: code === 0,
          exitCode: code ?? 1,
          stdout,
          stderr,
          // cmd /c reports a missing command as exit 1 with the shell's
          // "not recognized" text on stderr rather than an error event —
          // surface both paths as error.
          error:
            signal
              ? `terminated by ${signal}`
              : code !== 0 && code !== null && !stdout
                ? stderr.trim() || `exited with code ${code}`
                : undefined,
          durationMs: Date.now() - start,
        });
      });

      child.on("error", (err) => {
        resolve({
          name: cmd.name,
          passed: false,
          stdout,
          stderr,
          error: err.message,
          durationMs: Date.now() - start,
        });
      });
    });
  }
}
