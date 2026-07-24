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
  if (trimmed.split("\n").filter(Boolean).length > 1 && !trimmed.startsWith("[")) {
    return `This looks like NDJSON. Paste one JSON value instead. ${detail}`;
  }
  if (/[{,]\s*'|,\s*[a-zA-Z_$][\w$]*\s*:|,\s*[}\]]/.test(source)) {
    return `This looks like a JavaScript literal, not strict JSON. ${detail}`;
  }
  return detail;
}
