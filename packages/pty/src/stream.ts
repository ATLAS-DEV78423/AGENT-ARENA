export class OutputBuffer {
  private chunks: string[] = [];
  append(data: string) { this.chunks.push(data); }
  getAll(): string { return this.chunks.join(""); }
  getLast(n: number): string { return this.getAll().slice(-n); }
  contains(pattern: string | RegExp): boolean {
    const text = this.getAll();
    return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
  }
  clear() { this.chunks = []; }
}
