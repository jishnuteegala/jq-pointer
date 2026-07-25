import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { array, assert, constantFrom, oneof, property, subarray } from "fast-check";
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

const objectElement = array(constantFrom<JsonValue>("v", 1, null, true), {
  minLength: 1,
  maxLength: 4,
}).map(
  (values): JsonValue =>
    Object.fromEntries(allKeys.slice(0, values.length).map((k, i) => [k, values[i]])),
);

const mixedElement = oneof(objectElement, constantFrom<JsonValue>(5, "text", null, true, [1, 2]));

oracle("construction oracle", () => {
  it("emits a construction whose value stream matches real jq exactly", () => {
    assert(
      property(
        array(mixedElement, { minLength: 1, maxLength: 5 }),
        subarray(allKeys, { minLength: 2, maxLength: 4 }),
        (items, keys) => {
          const model = buildPathModel({ items });
          const firstObject = (items as JsonValue[]).findIndex(
            (value) => value !== null && typeof value === "object" && !Array.isArray(value),
          );
          if (firstObject === -1) return;
          const element = model.root.children?.[0]?.children?.[firstObject];
          if (element === undefined) return;
          const clicks = keys
            .map((key) => fieldNode(element, key))
            .filter((node): node is ModelNode => node !== undefined);
          if (clicks.length < 2) return;
          const selection = resolveSelection(clicks);
          const output = selection.outputs[0];
          if (selection.noCommonPattern || output.expression.kind !== "construction") return;
          const constructionKeys = output.expression.keys;
          const printed = printExpression(output.expression);
          const flat = evaluateJqExpression(model.root, output.expression).map(
            (node) => node.value,
          );
          const reconstructed: JsonValue[] = [];
          for (let index = 0; index < flat.length; index += constructionKeys.length) {
            reconstructed.push(
              Object.fromEntries(
                constructionKeys.map((key, offset) => [key, flat[index + offset]]),
              ),
            );
          }
          expect(reconstructed).toEqual(runJq({ items }, printed));
        },
      ),
      { numRuns: 300, seed: 61 },
    );
  });

  it("counts constructible (object or null) elements as N-of-M to match real jq", () => {
    assert(
      property(
        array(mixedElement, { minLength: 2, maxLength: 6 }),
        subarray(allKeys, { minLength: 2, maxLength: 4 }),
        (items, keys) => {
          const model = buildPathModel({ items });
          const firstObject = (items as JsonValue[]).findIndex(
            (value) => value !== null && typeof value === "object" && !Array.isArray(value),
          );
          if (firstObject === -1) return;
          const element = model.root.children?.[0]?.children?.[firstObject];
          if (element === undefined) return;
          const clicks = keys
            .map((key) => fieldNode(element, key))
            .filter((node): node is ModelNode => node !== undefined);
          if (clicks.length < 2) return;
          const selection = resolveSelection(clicks);
          const output = selection.outputs[0];
          if (selection.noCommonPattern || output.expression.kind !== "construction") return;
          const reference = runJq(
            { items },
            '[.items[] | (type == "object" or . == null)] | map(select(.)) | length',
          );
          expect(output.matchCount).toEqual(reference[0]);
          expect(output.elementCount).toBe(items.length);
        },
      ),
      { numRuns: 300, seed: 67 },
    );
  });
});
