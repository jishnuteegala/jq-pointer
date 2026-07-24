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

  it("reports a parse error for invalid JSON", () => {
    const outcome = parseDocument('{"a": 1,\n  "b": oops}');
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.message).toContain("JSON");
    }
  });

  it("builds a caret excerpt from line and column metadata", () => {
    const text = '{"a": 1,\n  "b": oops}';
    const excerpt = caretExcerpt(text, "Unexpected token at line 2 column 8");
    expect(excerpt).not.toBeNull();
    const [line, caret] = (excerpt as string).split("\n");
    expect(line).toBe('  "b": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("builds a caret excerpt from position metadata", () => {
    const text = '{"a": oops}';
    const excerpt = caretExcerpt(text, "Unexpected token o in JSON at position 6");
    expect(excerpt).not.toBeNull();
    const [line, caret] = (excerpt as string).split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("returns null for messages without position metadata", () => {
    expect(caretExcerpt("{", "is not valid JSON")).toBeNull();
  });

  it("still reports an error when position metadata is unavailable", () => {
    const outcome = parseDocument("");
    expect(outcome.kind).toBe("error");
  });
});
