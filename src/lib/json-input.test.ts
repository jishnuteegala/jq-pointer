import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, parseJsonInput } from "./json-input";

describe("parseJsonInput", () => {
  it("parses strict JSON", () => {
    expect(parseJsonInput('{"items":[0]}')).toEqual({ kind: "success", value: { items: [0] } });
  });

  it("names likely non-JSON input", () => {
    const result = parseJsonInput("{'item': 1}");
    expect(result.kind === "error" && result.message).toContain("JavaScript literal");
  });

  it("rejects input over the document cap", () => {
    expect(parseJsonInput(`"${"x".repeat(MAX_JSON_BYTES)}"`)).toEqual({
      kind: "error", message: "JSON must be 10MB or smaller.",
    });
  });
});
