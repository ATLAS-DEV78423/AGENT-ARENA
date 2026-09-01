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
    const content = output.slice(
      startIdx + startPattern.length,
      endIdx,
    );
    const after = output.slice(endIdx + delimiters.end.length);
    return before + content + after;
  }

  // Fallback: strip end delimiter from beginning and end of output
  let result = output;
  if (result.startsWith(delimiters.end)) {
    result = result.slice(delimiters.end.length);
  }
  // Strip leading newline after start delimiter
  if (result.startsWith("\n")) {
    result = result.slice(1);
  }
  // Strip trailing newline before checking end delimiter
  const trimmed = result.replace(/\n+$/, "");
  if (trimmed.endsWith(delimiters.end)) {
    result = trimmed.slice(0, -delimiters.end.length);
  }
  return result;
}
