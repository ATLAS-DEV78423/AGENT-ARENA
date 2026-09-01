import {
  DelimiterPair,
  findDelimiter,
  stripDelimiters,
} from "./delimiter.js";

export class ResponseBuffer {
  private raw = "";
  private delimiter: DelimiterPair;

  constructor(delimiter: DelimiterPair) {
    this.delimiter = delimiter;
  }

  append(data: string): void {
    this.raw += data;
  }

  hasCompleteResponse(): boolean {
    // Require the end delimiter to appear twice (once as prefix, once as suffix)
    // to avoid false positives when only the opening delimiter has arrived
    const first = this.raw.indexOf(this.delimiter.end);
    if (first === -1) return false;
    const afterFirst = this.raw.indexOf(
      this.delimiter.end,
      first + this.delimiter.end.length,
    );
    return afterFirst !== -1;
  }

  consumeResponse(): string {
    const response = stripDelimiters(this.raw, this.delimiter);
    const endIdx = this.raw.indexOf(this.delimiter.end);
    if (endIdx !== -1) {
      this.raw = this.raw.slice(
        endIdx + this.delimiter.end.length,
      );
    } else {
      this.raw = "";
    }
    // Trim leading newline from leftover (separator after end delimiter)
    this.raw = this.raw.replace(/^\n/, "");
    return response.trimEnd();
  }

  getRaw(): string {
    return this.raw;
  }

  clear(): void {
    this.raw = "";
  }
}
