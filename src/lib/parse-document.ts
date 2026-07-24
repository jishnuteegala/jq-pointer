import type { JsonValue } from "./json-value";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ParseOutcome =
  | { kind: "ok"; value: JsonValue }
  | { kind: "too-large"; bytes: number; limit: number }
  | { kind: "error"; message: string; excerpt: string | null };

export function parseDocument(text: string): ParseOutcome {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_DOCUMENT_BYTES) {
    return { kind: "too-large", bytes, limit: MAX_DOCUMENT_BYTES };
  }
  try {
    const value = JSON.parse(text) as JsonValue;
    return { kind: "ok", value };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    const message = `${inputHint(text)}${detail}`;
    return { kind: "error", message, excerpt: caretExcerpt(text, detail) };
  }
}

function inputHint(text: string): string {
  const trimmed = text.trim();
  if (trimmed.split("\n").filter(Boolean).length > 1 && !trimmed.startsWith("[")) {
    return "This looks like NDJSON. Paste one JSON value instead. ";
  }
  if (/[{,]\s*'|[{,]\s*[a-zA-Z_$][\w$]*\s*:|,\s*[}\]]/.test(trimmed)) {
    return "This looks like a JavaScript literal, not strict JSON. ";
  }
  return "";
}

export function caretExcerpt(text: string, message: string): string | null {
  const lineColumn = message.match(/line (\d+) column (\d+)/);
  const position = message.match(/position (\d+)/);
  let offset: number | null = null;
  if (lineColumn !== null) {
    const line = Number(lineColumn[1]);
    const column = Number(lineColumn[2]);
    let lineStart = 0;
    for (let seen = 1; seen < line; seen++) {
      const next = text.indexOf("\n", lineStart);
      if (next === -1) return null;
      lineStart = next + 1;
    }
    offset = lineStart + column - 1;
  } else if (position !== null) {
    offset = Number(position[1]);
  }
  if (offset === null || offset > text.length) return null;
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const lineEnd = text.indexOf("\n", offset);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const column = offset - lineStart;
  const from = Math.max(0, column - 40);
  const shown = line.slice(from, from + 80);
  return `${shown}\n${" ".repeat(column - from)}^`;
}
