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
    return findDelimiter(this.raw, this.delimiter.end);
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
