import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { printPath, type JqExpression } from "./jq-expression";

const jq = process.env.JQ_BINARY ?? "./jq-1.7.1";
const canRunOracle = platform() !== "win32" && existsSync(jq);
const oracle = canRunOracle ? describe : describe.skip;

function runJq(document: unknown, expression: string): unknown[] {
  const output = execFileSync(jq, ["--compact-output", expression], {
    encoding: "utf8",
    input: JSON.stringify(document),
  });
  return output.trim() === ""
    ? []
    : output
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown);
}

oracle("jq 1.7.1 printer oracle", () => {
  it("accepts and evaluates emitted key paths", () => {
    assert(
      property(string({ unit: constantFrom("a", "-", " ", '"', "\\", "😀") }), (key) => {
        const document = { [key]: key };
        expect(runJq(document, printPath([{ kind: "key", key }]))).toEqual([key]);
      }),
      { numRuns: 100, seed: 7 },
    );
  });

  it("matches jq iterator and optional step behavior", () => {
    const document = { items: [{ name: "a" }, {}, { name: "c" }] };
    const expression: JqExpression = {
      kind: "path",
      steps: [
        { kind: "key", key: "items" },
        { kind: "iterate" },
        { kind: "key", key: "name", optional: true },
      ],
    };
    expect(runJq(document, printPath(expression.steps))).toEqual(["a", null, "c"]);
  });
});
