import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateJqExpression, parseExpression } from "./jq-expression";
import type { JsonValue } from "./json-value";
import { buildPathModel } from "./path-model";

interface JqTest {
  program: string;
  input: JsonValue;
  expected: unknown[];
}

function readTests(): JqTest[] {
  const groups = readFileSync(new URL("./vendor/jq.test", import.meta.url), "utf8")
    .split(/\r?\n\r?\n/)
    .map((group) => group.split(/\r?\n/).filter((line) => !line.startsWith("#") && line !== ""))
    .filter((lines) => lines.length >= 3);
  return groups.flatMap(([program, input, ...expected]) => {
    try {
      return [
        {
          program,
          input: JSON.parse(input) as JsonValue,
          expected: expected.map((line) => JSON.parse(line)),
        },
      ];
    } catch {
      return [];
    }
  });
}

const applicable = readTests().filter((test) => parseExpression(test.program) !== null);

describe("jq conformance", () => {
  it("keeps a meaningful in-subset slice of jq's official suite", () => {
    expect(applicable.length).toBeGreaterThanOrEqual(5);
  });

  it("evaluates each accepted jq test program", () => {
    for (const test of applicable) {
      const expression = parseExpression(test.program);
      if (expression === null) throw new Error(`accepted program did not parse: ${test.program}`);
      expect(
        evaluateJqExpression(buildPathModel(test.input).root, expression).map((node) => node.value),
      ).toEqual(test.expected);
    }
  });
});
