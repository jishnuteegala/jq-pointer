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

  it("builds a caret excerpt from Chromium-style token metadata", () => {
    const text = '{"b": oops}';
    const excerpt = caretExcerpt(text, `Unexpected token 'o', "${text}" is not valid JSON`);
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('{"b": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("skips the token inside a matching key when locating the Chromium caret", () => {
    const text = '{"oops": oops}';
    const excerpt = caretExcerpt(text, `Unexpected token 'o', "${text}" is not valid JSON`);
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('{"oops": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf(": oops") + 2);
  });

  it("builds a caret excerpt from a truncated Chromium snippet", () => {
    const text = '{"a": 1,\n  "b": oops}';
    const excerpt = caretExcerpt(
      text,
      'Unexpected token \'o\', ..."1,\n  "b": oops}" is not valid JSON',
    );
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('  "b": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("resumes string state when a truncated Chromium snippet starts mid-string", () => {
    const text = '{"a":"x oops","b":oops}';
    const excerpt = caretExcerpt(
      text,
      'Unexpected token \'o\', ..."oops","b":oops}" is not valid JSON',
    );
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe(text);
    expect(caret.indexOf("^")).toBe(text.indexOf('"b":oops') + 4);
  });

  it("locates the token from a WebKit-style identifier error outside strings", () => {
    const text = '{"a": "oops", "b": oops}';
    const excerpt = caretExcerpt(text, 'JSON Parse error: Unexpected identifier "oops"');
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe(text);
    expect(caret.indexOf("^")).toBe(text.indexOf('"b": oops') + 5);
  });

  it("locates the quote for Safari's single-quote error in multiline input", () => {
    const text = "{\n  'a': 1,\n  \"b\": 2\n}";
    const excerpt = caretExcerpt(
      text,
      "JSON Parse error: Single quotes (') are not allowed in JSON",
    );
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe("  'a': 1,");
    expect(caret.indexOf("^")).toBe(line.indexOf("'"));
  });

  it("locates a single-quoted value for Safari's unpositioned error", () => {
    const text = "{\n  \"a\": 'x'\n}";
    const excerpt = caretExcerpt(
      text,
      "JSON Parse error: Single quotes (') are not allowed in JSON",
    );
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe("  \"a\": 'x'");
    expect(caret.indexOf("^")).toBe(line.indexOf("'"));
  });

  it("locates the offending token for Safari errors without token metadata", () => {
    const missingComma = '{\n  "a": 1\n  "b": 2\n}';
    const excerpt = caretExcerpt(missingComma, "JSON Parse error: Expected '}'");
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('  "b": 2');
    expect(caret.indexOf("^")).toBe(line.indexOf('"b"'));
  });

  it("scans past escapes and nested structures to find the error position", () => {
    const text = '{"a": "q\\"uote", "b": [1, {"c": null}], "d": tru}';
    const excerpt = caretExcerpt(text, "JSON Parse error: Unexpected character");
    const [line, caret] = excerpt.split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("tru}") + 3);
  });

  it("points at trailing garbage after a complete value", () => {
    const text = '{"a": 1} garbage';
    const excerpt = caretExcerpt(text, "JSON Parse error: Unexpected content at end");
    const [line, caret] = excerpt.split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("garbage"));
  });

  it("points at the second occurrence of a repeated token, not the first", () => {
    const text = "[1 1]";
    const excerpt = caretExcerpt(text, 'JSON Parse error: Unexpected number "1"');
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe("[1 1]");
    expect(caret.indexOf("^")).toBe(3);
  });

  it("points at an invalid escape sequence inside a string", () => {
    const text = '{"a": "bad\\q"}';
    const excerpt = caretExcerpt(text, "JSON Parse error: Invalid escape character q");
    const [line, caret] = excerpt.split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("\\q"));
  });

  it("points at an unescaped control character inside a string", () => {
    const text = '{"a": "x\ty"}';
    const excerpt = caretExcerpt(text, "JSON Parse error: Unterminated string");
    const [line, caret] = excerpt.split("\n");
    expect(caret.indexOf("^")).toBe(line.indexOf("\t"));
  });

  it("reports line numbers across lone carriage-return separators", () => {
    const outcome = parseDocument('{"a": 1}\r{"b": 2}');
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.message).toMatch(/line 2, column 1/);
      expect(outcome.excerpt.split("\n")[0]).toBe('{"b": 2}');
    }
  });

  it("points at the first mismatching character of a malformed literal", () => {
    const truncated = caretExcerpt("[tru]", "Unexpected token ']'");
    const [truncatedLine, truncatedCaret] = truncated.split("\n");
    expect(truncatedCaret.indexOf("^")).toBe(truncatedLine.indexOf("]"));
    const corrupted = caretExcerpt('{"a":trXe}', "Unexpected token 'X'");
    const [corruptedLine, corruptedCaret] = corrupted.split("\n");
    expect(corruptedCaret.indexOf("^")).toBe(corruptedLine.indexOf("X"));
  });

  it("points at the missing digit of an incomplete number", () => {
    const cases: Array<[string, number]> = [
      ["[-]", 2],
      ["[1e]", 3],
      ["[1e+]", 4],
      ["[1.]", 3],
    ];
    for (const [text, expected] of cases) {
      const excerpt = caretExcerpt(text, "is not valid JSON");
      const [, caret] = excerpt.split("\n");
      expect(caret.indexOf("^"), text).toBe(expected);
    }
  });

  it("resolves line and column metadata over CR-only line endings", () => {
    const text = '{"a": 1,\r  "b": oops}';
    const excerpt = caretExcerpt(text, "Unexpected token at line 2 column 8");
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('  "b": oops}');
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("detects NDJSON with CR-only line endings", () => {
    const outcome = parseDocument('{"a": 1}\r{"a": 2}');
    expect(outcome.kind === "error" && outcome.message).toContain("NDJSON");
  });

  it("ignores metadata-like text inside Chromium's quoted snippet", () => {
    const positionKey = '{"position 1":oops}';
    const positionExcerpt = caretExcerpt(
      positionKey,
      `Unexpected token 'o', "${positionKey}" is not valid JSON`,
    );
    const [positionLine, positionCaret] = positionExcerpt.split("\n");
    expect(positionCaret.indexOf("^")).toBe(positionLine.indexOf("oops"));
    const lineColumnKey = '{"line 1 column 2":oops}';
    const lineColumnExcerpt = caretExcerpt(
      lineColumnKey,
      `Unexpected token 'o', "${lineColumnKey}" is not valid JSON`,
    );
    const [lineColumnLine, lineColumnCaret] = lineColumnExcerpt.split("\n");
    expect(lineColumnCaret.indexOf("^")).toBe(lineColumnLine.indexOf("oops"));
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

  it("detects NDJSON with CRLF line endings", () => {
    const outcome = parseDocument('{"a": 1}\r\n{"a": 2}\r\n');
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

  it("preserves tab indentation when positioning the caret", () => {
    const text = '{\n\t"a": oops\n}';
    const excerpt = caretExcerpt(text, "Unexpected token at line 2 column 7");
    const [line, caret] = excerpt.split("\n");
    expect(line).toBe('\t"a": oops');
    expect(caret).toBe("\t     ^");
    expect(caret.indexOf("^")).toBe(line.indexOf("oops"));
  });

  it("detects numeric and unicode unquoted keys as JavaScript literals", () => {
    const numeric = parseDocument('{1: "x"}');
    expect(numeric.kind === "error" && numeric.message).toContain("JavaScript literal");
    const unicode = parseDocument("{\u03c0: 1}");
    expect(unicode.kind === "error" && unicode.message).toContain("JavaScript literal");
    const decimal = parseDocument('{1.5: "x"}');
    expect(decimal.kind === "error" && decimal.message).toContain("JavaScript literal");
    const hex = parseDocument("{0xff: 1}");
    expect(hex.kind === "error" && hex.message).toContain("JavaScript literal");
  });

  it("detects a top-level single-quoted literal and single quotes in arrays", () => {
    const outcome = parseDocument("'hello'");
    expect(outcome.kind === "error" && outcome.message).toContain("JavaScript literal");
    const array = parseDocument("['a', 'b']");
    expect(array.kind === "error" && array.message).toContain("JavaScript literal");
  });

  it("does not flag JS-literal markers inside JSON strings", () => {
    const quote = parseDocument('{"a": "it\'s , }"');
    expect(quote.kind === "error" && quote.message).not.toContain("JavaScript literal");
    const colon = parseDocument('{"note": "key: value" oops}');
    expect(colon.kind === "error" && colon.message).not.toContain("JavaScript literal");
  });

  it("prefers the JavaScript-literal hint for multiline literals", () => {
    const outcome = parseDocument('{\n  "a": 1,\n  "b": 2,\n}');
    expect(outcome.kind === "error" && outcome.message).toContain("JavaScript literal");
    expect(outcome.kind === "error" && outcome.message).not.toContain("NDJSON");
  });

  it("does not misclassify a multiline object as NDJSON", () => {
    const outcome = parseDocument('{\n  "a": 1\n  "b": 2\n}');
    expect(outcome.kind === "error" && outcome.message).not.toContain("NDJSON");
  });

  it("still reports an error with an excerpt for empty input", () => {
    const outcome = parseDocument("");
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") expect(outcome.excerpt).toContain("^");
  });

  it("never repairs detected NDJSON or JS-literal input", () => {
    expect(parseDocument('{"a": 1}\n{"a": 2}').kind).toBe("error");
    expect(parseDocument('{"item": 1,}').kind).toBe("error");
    expect(parseDocument("{'item': 1}").kind).toBe("error");
    expect(parseDocument("{item: 1}").kind).toBe("error");
  });

  it("follows JSON.parse last-wins semantics for duplicate keys", () => {
    const outcome = parseDocument('{"a": 1, "a": 2}');
    expect(outcome).toEqual({ kind: "ok", value: { a: 2 } });
  });

  it("follows JSON.parse double-precision semantics for large numbers", () => {
    const outcome = parseDocument('{"n": 9007199254740993}');
    expect(outcome).toEqual({ kind: "ok", value: { n: 9007199254740992 } });
  });
});
