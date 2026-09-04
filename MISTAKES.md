# Arena Mistake Log

## Format
### YYYY-MM-DD — Title
**What happened:** ...
**Root cause:** ...
**Prevention:** ...
**Graduation candidate:** yes/no

---

### 2026-09-04 — win32 ENOENT on .cmd shims made every session end in timeout
**What happened:** Fake-agent sessions on Windows always exhausted all 5 rounds and ended `timeout`. Verification "failed" every round with no output. Two relay tests and one generic test also failed on Windows only.
**Root cause:** Three separate `execFile(command)` / `exec("x.sh")` call sites assumed POSIX resolution. On win32: (1) `exec()` with a script path resolves through file association to git-bash.exe, a GUI app that detaches stdio — hangs until SIGTERM; (2) npm-installed CLIs (pnpm, opencode) are `.cmd` shims — `execFile('pnpm')` throws ENOENT, so the verification gate failed 100% of sessions on Windows; (3) a test used `cwd: "/tmp"` which doesn't exist on win32.
**Prevention:** Never build shell strings with interpolated values (`exec`); on win32 route through `cmd /c` (keeps stdout/stderr as separate pipes, resolves `.cmd` shims) or bridge scripts through `sh`. Always use `os.tmpdir()` in tests. Test on all three platforms in CI.
**Graduation candidate:** yes
