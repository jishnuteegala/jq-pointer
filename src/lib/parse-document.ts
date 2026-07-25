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
    const line = text.slice(0, offset).split(/\r\n|\r|\n/).length;
    const column = offset - lineStartAt(text, offset) + 1;
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
  const scanned = safeScanOffset(text);
  if (scanned !== null) return scanned;
  const browser = browserOffset(text, message);
  if (browser !== null) return browser;
  const webkit = webkitOffset(text, message);
  if (webkit !== null) return webkit;
  return text.length;
}

function safeScanOffset(text: string): number | null {
  try {
    return scanOffset(text);
  } catch {
    return null;
  }
}

function webkitOffset(text: string, message: string): number | null {
  const token = message.match(/Unexpected (?:identifier|keyword|number) ["']([^"']+)["']/);
  if (token === null) return null;
  const masked = maskStrings(text);
  const at = masked.indexOf(token[1]);
  return at === -1 ? null : at;
}

type ScanResult = { end: number } | { error: number };

function scanOffset(text: string): number | null {
  const start = skipWhitespace(text, 0);
  if (start >= text.length) return null;
  const result = scanValue(text, start);
  if ("error" in result) return result.error;
  const after = skipWhitespace(text, result.end);
  return after < text.length ? after : null;
}

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && " \t\n\r".includes(text[index])) index++;
  return index;
}

function scanValue(text: string, index: number): ScanResult {
  const char = text[index];
  if (char === "{") return scanObject(text, index);
  if (char === "[") return scanArray(text, index);
  if (char === '"') return scanString(text, index);
  if (char === "-" || (char >= "0" && char <= "9")) return scanNumber(text, index);
  for (const word of ["true", "false", "null"]) {
    if (text.startsWith(word, index)) return { end: index + word.length };
  }
  return { error: Math.min(index, text.length) };
}

function scanObject(text: string, index: number): ScanResult {
  index = skipWhitespace(text, index + 1);
  if (text[index] === "}") return { end: index + 1 };
  for (;;) {
    if (text[index] !== '"') return { error: index };
    const key = scanString(text, index);
    if ("error" in key) return key;
    index = skipWhitespace(text, key.end);
    if (text[index] !== ":") return { error: index };
    index = skipWhitespace(text, index + 1);
    const value = scanValue(text, index);
    if ("error" in value) return value;
    index = skipWhitespace(text, value.end);
    if (text[index] === "}") return { end: index + 1 };
    if (text[index] !== ",") return { error: index };
    index = skipWhitespace(text, index + 1);
  }
}

function scanArray(text: string, index: number): ScanResult {
  index = skipWhitespace(text, index + 1);
  if (text[index] === "]") return { end: index + 1 };
  for (;;) {
    const value = scanValue(text, index);
    if ("error" in value) return value;
    index = skipWhitespace(text, value.end);
    if (text[index] === "]") return { end: index + 1 };
    if (text[index] !== ",") return { error: index };
    index = skipWhitespace(text, index + 1);
  }
}

function scanString(text: string, index: number): ScanResult {
  for (let at = index + 1; at < text.length; at++) {
    const char = text[at];
    if (char === "\\") {
      const next = text[at + 1];
      if (next !== undefined && '"\\/bfnrt'.includes(next)) {
        at++;
        continue;
      }
      if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(at + 2, at + 6))) {
        at += 5;
        continue;
      }
      return { error: at };
    }
    if (char === '"') return { end: at + 1 };
    if (char < " ") return { error: at };
  }
  return { error: text.length };
}

function scanNumber(text: string, index: number): ScanResult {
  const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index));
  if (match === null) return { error: index };
  return { end: index + match[0].length };
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
    const local = tokenOffset(source, marker, insideString(text, base));
    return local === -1 ? base : base + local;
  }
  const at = tokenOffset(source, marker, false);
  return at === -1 ? null : Math.min(text.length, at);
}

function insideString(text: string, end: number): boolean {
  let inString = false;
  for (let index = 0; index < end; index++) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
  }
  return inString;
}

function tokenOffset(source: string, marker: string, startInString: boolean): number {
  let inString = startInString;
  let firstInString = -1;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (char === "\\") {
        index++;
        continue;
      }
      if (char === '"') inString = false;
      else if (char === marker && firstInString === -1) firstInString = index;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === marker) return index;
  }
  return firstInString;
}

function lineStartAt(text: string, offset: number): number {
  const newline = text.lastIndexOf("\n", Math.max(0, offset - 1));
  const carriage = text.lastIndexOf("\r", Math.max(0, offset - 1));
  return Math.max(newline, carriage) + 1;
}

function lineEndAt(text: string, offset: number): number {
  for (let at = offset; at < text.length; at++) {
    if (text[at] === "\n" || text[at] === "\r") return at;
  }
  return text.length;
}

function excerptAt(text: string, offset: number): string {
  const lineStart = lineStartAt(text, offset);
  const line = text.slice(lineStart, lineEndAt(text, offset));
  const column = offset - lineStart;
  const from = Math.max(0, column - 40);
  const shown = line.slice(from, from + 80);
  const prefix = shown.slice(0, column - from).replace(/[^\t]/g, " ");
  return `${shown}\n${prefix}^`;
}

function inputHint(text: string): string {
  const trimmed = text.trim();
  if (looksLikeJsLiteral(trimmed)) {
    return "This looks like a JavaScript literal, not strict JSON. ";
  }
  if (looksLikeNdjson(trimmed)) {
    return "This looks like NDJSON. Paste one JSON value instead. ";
  }
  return "";
}

function looksLikeJsLiteral(trimmed: string): boolean {
  const masked = maskStrings(trimmed);
  return /^'|[{[,:]\s*'|[{,]\s*(?:[\p{ID_Start}$][\p{ID_Continue}$]*|[\d.][\w.+-]*)\s*:|,\s*[}\]]/u.test(
    masked,
  );
}

function maskStrings(text: string): string {
  let masked = "";
  let inString = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (char === "\\") {
        masked += "  ";
        index++;
        continue;
      }
      if (char === '"') {
        inString = false;
        masked += char;
      } else {
        masked += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (char === '"') inString = true;
    masked += char;
  }
  return masked;
}

function looksLikeNdjson(trimmed: string): boolean {
  const lines = trimmed.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return false;
  return lines.every((line) => {
    try {
      JSON.parse(line);
      return true;
    } catch {
      return false;
    }
  });
}

export function caretExcerpt(text: string, message: string): string {
  return excerptAt(text, errorOffset(text, message));
}
