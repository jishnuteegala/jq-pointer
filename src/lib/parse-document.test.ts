import { describe, expect, it } from "vitest";
import { caretExcerpt, MAX_DOCUMENT_BYTES, parseDocument } from "./parse-document";

describe("parseDocument", () => {
  it("parses valid JSON", () => {
    const outcome = parseDocument('{"a": [1, 2]}');
    expect(outcome).toEqual({ kind: "ok", value: { a: [1, 2] } });
  });

  it("rejects documents over the byte cap", () => {
    const text = `"${"x".repeat(MAX_DOCUMENT_BYTES)}"`;
    const outcome = parseDocument(text);
    expect(outcome.kind).toBe("too-large");
    if (outcome.kind === "too-large") {
      expect(outcome.bytes).toBeGreaterThan(MAX_DOCUMENT_BYTES);
      expect(outcome.limit).toBe(MAX_DOCUMENT_BYTES);
    }
  });

  it("counts bytes not code units for the cap", () => {
    const text = `"${"\u00e9".repeat(MAX_DOCUMENT_BYTES / 2)}"`;
    expect(parseDocument(text).kind).toBe("too-large");
  });

  it("reports a parse error with position and excerpt for invalid JSON", () => {
    const outcome = parseDocument('{"a": 1,\n  "b": oops}');
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.message).toMatch(/line \d+, column \d+/);
      expect(outcome.excerpt).toContain("^");
    }
  });

  it("builds a caret excerpt from line and column metadata", () => {
    const text = '{"a": 1,\n  "b": oops}';
    const excerpt = caretExcerpt(text, "Unexpected token at line 2 column 8");
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('  "b": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("builds a caret excerpt from position metadata", () => {
    const text = '{"a": oops}';
    const excerpt = caretExcerpt(text, "Unexpected token o in JSON at position 6");
    const [line, caret] = excerpt.split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("falls back to end of input when position metadata is missing", () => {
    const excerpt = caretExcerpt('{"a": 1', "is not valid JSON");
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('{"a": 1');
    expect(caret.indexOf("^")).toBe(line.length);
  });

  it("reports position for truncated documents", () => {
    const outcome = parseDocument('{"a": [1, 2');
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.message).toMatch(/line 1, column \d+/);
      expect(outcome.excerpt.split("\n")[1]).toContain("^");
    }
  });

  it("names likely NDJSON input", () => {
    const outcome = parseDocument('{"a": 1}\n{"a": 2}');
    expect(outcome.kind === "error" && outcome.message).toContain("NDJSON");
  });

  it("names likely JavaScript-literal input", () => {
    const outcome = parseDocument("{'item': 1}");
    expect(outcome.kind === "error" && outcome.message).toContain("JavaScript literal");
    const unquoted = parseDocument("{item: 1}");
    expect(unquoted.kind === "error" && unquoted.message).toContain("JavaScript literal");
    const trailing = parseDocument('{"item": 1,}');
    expect(trailing.kind === "error" && trailing.message).toContain("JavaScript literal");
  });

  it("still reports an error with an excerpt for empty input", () => {
    const outcome = parseDocument("");
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") expect(outcome.excerpt).toContain("^");
  });
});
