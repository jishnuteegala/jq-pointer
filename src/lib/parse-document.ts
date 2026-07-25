import type { JsonValue } from "./json-value";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ParseOutcome =
  | { kind: "ok"; value: JsonValue }
  | { kind: "too-large"; bytes: number; limit: number }
  | { kind: "error"; message: string; excerpt: string };

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
    const offset = errorOffset(text, detail);
    const line = text.slice(0, offset).split("\n").length;
    const column = offset - (text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1) + 1;
    const message = `${inputHint(text)}${detail} (line ${line}, column ${column})`;
    return { kind: "error", message, excerpt: excerptAt(text, offset) };
  }
}

function errorOffset(text: string, message: string): number {
  const lineColumn = message.match(/line (\d+) column (\d+)/);
  if (lineColumn !== null) {
    const line = Number(lineColumn[1]);
    const column = Number(lineColumn[2]);
    let lineStart = 0;
    let found = true;
    for (let seen = 1; seen < line; seen++) {
      const next = text.indexOf("\n", lineStart);
      if (next === -1) {
        found = false;
        break;
      }
      lineStart = next + 1;
    }
    if (found) return Math.min(text.length, lineStart + column - 1);
  }
  const position = message.match(/position (\d+)/);
  if (position !== null) return Math.min(text.length, Number(position[1]));
  const browser = browserOffset(text, message);
  if (browser !== null) return browser;
  return text.length;
}

function browserOffset(text: string, message: string): number | null {
  const snippet = message.match(/(\.\.\.)?"([\s\S]*)"\s+is not valid JSON/);
  if (snippet === null) return null;
  const truncatedStart = snippet[1] !== undefined;
  const source = snippet[2].replace(/\.\.\.$/, "");
  const token = message.match(/Unexpected token '?(.)'?/);
  const marker = token !== null ? token[1] : source.trimEnd().slice(-1);
  if (truncatedStart) {
    const base = text.indexOf(source);
    if (base === -1) return null;
    const local = source.indexOf(marker);
    return local === -1 ? base : base + local;
  }
  const at = source.indexOf(marker);
  return at === -1 ? null : Math.min(text.length, at);
}

function excerptAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const lineEnd = text.indexOf("\n", offset);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const column = offset - lineStart;
  const from = Math.max(0, column - 40);
  const shown = line.slice(from, from + 80);
  return `${shown}\n${" ".repeat(column - from)}^`;
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

export function caretExcerpt(text: string, message: string): string {
  return excerptAt(text, errorOffset(text, message));
}
