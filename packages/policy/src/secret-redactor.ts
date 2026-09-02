const DEFAULT_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /glpat-[a-zA-Z0-9\-]{20,}/g,
  /xox[bpas]-[a-zA-Z0-9\-]+/g,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC )?PRIVATE KEY-----/g,
];

export class SecretRedactor {
  private patterns: RegExp[];

  constructor() {
    this.patterns = [...DEFAULT_PATTERNS];
  }

  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  redact(input: string): string {
    let result = input;
    for (const pattern of this.patterns) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }
}
