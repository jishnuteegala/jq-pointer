import type { JsonValue } from "./json-value";

export const MAX_JSON_BYTES = 10 * 1024 * 1024;

export type JsonInputResult =
  | { kind: "success"; value: JsonValue }
  | { kind: "error"; message: string };

export function parseJsonInput(source: string): JsonInputResult {
  if (new TextEncoder().encode(source).byteLength > MAX_JSON_BYTES) {
    return { kind: "error", message: "JSON must be 10MB or smaller." };
  }
  try {
    return { kind: "success", value: JSON.parse(source) as JsonValue };
  } catch (error) {
    const detail = error instanceof SyntaxError ? error.message : "Invalid JSON";
    return { kind: "error", message: inputHint(source, detail) };
  }
}

function inputHint(source: string, detail: string): string {
  const trimmed = source.trim();
  let hint = "";
  if (trimmed.split("\n").filter(Boolean).length > 1 && !trimmed.startsWith("[")) {
    hint = "This looks like NDJSON. Paste one JSON value instead. ";
  } else if (/[{,]\s*'|,\s*[a-zA-Z_$][\w$]*\s*:|,\s*[}\]]/.test(source)) {
    hint = "This looks like a JavaScript literal, not strict JSON. ";
  }
  return `${hint}${detail}\n${caretExcerpt(source, detail)}`;
}

function caretExcerpt(source: string, detail: string): string {
  const match = /position (\d+)/.exec(detail);
  const token = /Unexpected token '(.+?)'/.exec(detail);
  const position = match === null ? (token === null ? -1 : source.indexOf(token[1])) : Number(match[1]);
  if (position < 0) return "";
  const before = source.slice(0, position);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEnd = source.indexOf("\n", position);
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
  return `${line}\n${" ".repeat(position - lineStart)}^`;
}
