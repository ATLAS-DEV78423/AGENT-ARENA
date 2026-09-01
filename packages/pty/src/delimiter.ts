import { randomUUID } from "node:crypto";

export interface DelimiterPair {
  start: string;
  end: string;
}

export function createDelimiter(): DelimiterPair {
  const id = randomUUID().slice(0, 8);
  return {
    start: `__ARENA_DELIM_START_${id}__`,
    end: `__ARENA_DELIM_END_${id}__`,
  };
}

export function findDelimiter(output: string, delimiter: string): boolean {
  return output.includes(delimiter);
}

export function stripDelimiters(
  output: string,
  delimiters: DelimiterPair,
): string {
  // Find content between start and end delimiters, stripping associated newlines
  const startPattern = delimiters.start + "\n";
  const endPattern = "\n" + delimiters.end;

  const startIdx = output.indexOf(startPattern);
  const endIdx = output.indexOf(delimiters.end);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = output.slice(0, startIdx);
    // Strip leading newline after start delimiter and trailing newline before end delimiter
    const rawContent = output.slice(
      startIdx + startPattern.length,
      endIdx,
    );
    const content = rawContent.replace(/^\n/, "").replace(/\n$/, "");
    const after = output.slice(endIdx + delimiters.end.length);
    return before + content + after;
  }

  // Fallback: strip delimiters without newline handling
  let result = output;
  const si = result.indexOf(delimiters.start);
  if (si !== -1) result = result.slice(si + delimiters.start.length);
  const ei = result.indexOf(delimiters.end);
  if (ei !== -1)
    result = result.slice(0, ei) + result.slice(ei + delimiters.end.length);
  return result;
}
