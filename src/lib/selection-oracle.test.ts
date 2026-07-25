import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { array, assert, constantFrom, property, subarray } from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateJqExpression, printExpression } from "./jq-expression";
import type { JsonValue } from "./json-value";
import { buildPathModel, type ModelNode } from "./path-model";
import { resolveSelection } from "./selection";

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

const allKeys = ["name", "id", "a-b", "2fa"];

function fieldNode(element: ModelNode, key: string): ModelNode | undefined {
  return element.children?.find((c) => c.segment?.kind === "key" && c.segment.key === key);
}

oracle("construction oracle", () => {
  it("emits a construction whose value stream matches real jq exactly", () => {
    assert(
      property(
        array(
          array(constantFrom<JsonValue>("v", 1, null, true), { minLength: 1, maxLength: 4 }).map(
            (values): JsonValue =>
              Object.fromEntries(allKeys.slice(0, values.length).map((k, i) => [k, values[i]])),
          ),
          { minLength: 1, maxLength: 4 },
        ),
        subarray(allKeys, { minLength: 2, maxLength: 4 }),
        (items, keys) => {
          const model = buildPathModel({ items });
          const element = model.root.children?.[0]?.children?.[0];
          if (element === undefined) return;
          const clicks = keys.map((key) => fieldNode(element, key)).filter(
            (node): node is ModelNode => node !== undefined,
          );
          if (clicks.length < 2) return;
          const selection = resolveSelection(clicks);
          const output = selection.outputs[0];
          if (selection.noCommonPattern || output.expression.kind !== "construction") return;
          const printed = printExpression(output.expression);
          const evaluated = evaluateJqExpression(model.root, output.expression).map(
            (node) => node.value,
          );
          expect(evaluated).toEqual(runJq({ items }, printed));
        },
      ),
      { numRuns: 200, seed: 61 },
    );
  });
});
