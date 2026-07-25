import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { array, assert, boolean, constantFrom, integer, oneof, property, tuple } from "fast-check";
import { describe, expect, it } from "vitest";
import { generaliseClickPair } from "./click-pair";
import { evaluateJqExpression, printPath } from "./jq-expression";
import type { JsonValue } from "./json-value";
import { buildPathModel, type ModelNode } from "./path-model";

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

function firstTwoWithName(items: ModelNode): [ModelNode, ModelNode] | null {
  const withName: ModelNode[] = [];
  for (const element of items.children ?? []) {
    const leaf = element.children?.find(
      (candidate) => candidate.segment?.kind === "key" && candidate.segment.key === "name",
    );
    if (leaf !== undefined) withName.push(leaf);
    if (withName.length === 2) return [withName[0], withName[1]];
  }
  return null;
}

const element = oneof(
  tuple(boolean(), constantFrom<JsonValue>("x", null, 1, true)).map(
    ([hasName, value]): JsonValue => (hasName ? { name: value } : {}),
  ),
  constantFrom<JsonValue>(5, "text", null, [1, 2], { other: 1 }),
);

oracle("click-pair heterogeneity oracle", () => {
  it("counts N-of-M presence to match real jq has()", () => {
    assert(
      property(array(element, { minLength: 2, maxLength: 8 }), (items) => {
        const model = buildPathModel({ items });
        const pair = firstTwoWithName(model.root.children?.[0] as ModelNode);
        if (pair === null) return;
        const result = generaliseClickPair(pair[0], pair[1]);
        if (result === null) throw new Error("expected generalisation");
        const reference = runJq(
          { items },
          '[.items[] | if type == "object" then has("name") else false end] | map(select(.)) | length',
        );
        expect(result.matchCount).toEqual(reference[0]);
        expect(result.elementCount).toBe(items.length);
      }),
      { numRuns: 200, seed: 41 },
    );
  });

  it("emits a ? form whose full value stream matches real jq exactly", () => {
    assert(
      property(array(element, { minLength: 2, maxLength: 8 }), (items) => {
        const model = buildPathModel({ items });
        const pair = firstTwoWithName(model.root.children?.[0] as ModelNode);
        if (pair === null) return;
        const result = generaliseClickPair(pair[0], pair[1]);
        if (result === null) throw new Error("expected generalisation");
        const printed = printPath(result.expression.steps);
        const evaluated = evaluateJqExpression(model.root, result.expression).map(
          (node) => node.value,
        );
        expect(evaluated).toEqual(runJq({ items }, printed));
      }),
      { numRuns: 200, seed: 43 },
    );
  });

  it("places ? on nested iterators to match real jq when arrays are null or missing", () => {
    const nestedElement = oneof(
      array(constantFrom<JsonValue>({ value: "v" }, { value: null }, 3), {
        maxLength: 3,
      }).map((children): JsonValue => ({ children })),
      constantFrom<JsonValue>({ children: null }, {}, 7, null),
    );
    assert(
      property(
        array(nestedElement, { minLength: 2, maxLength: 6 }),
        integer({ min: 0, max: 2 }),
        integer({ min: 0, max: 2 }),
        (items, iA, iB) => {
          const model = buildPathModel({ items });
          const itemsNode = model.root.children?.[0] as ModelNode;
          const reachable: ModelNode[] = [];
          for (const el of itemsNode.children ?? []) {
            const children = el.children?.find(
              (c) => c.segment?.kind === "key" && c.segment.key === "children",
            );
            const target = children?.children;
            if (target === undefined || target === null) continue;
            const idx = reachable.length === 0 ? iA : iB;
            const cell = target[Math.min(idx, target.length - 1)];
            const value = cell?.children?.find(
              (c) => c.segment?.kind === "key" && c.segment.key === "value",
            );
            if (value !== undefined) reachable.push(value);
            if (reachable.length === 2) break;
          }
          if (reachable.length < 2) return;
          const result = generaliseClickPair(reachable[0], reachable[1]);
          if (result === null) return;
          const printed = printPath(result.expression.steps);
          const evaluated = evaluateJqExpression(model.root, result.expression).map(
            (node) => node.value,
          );
          expect(evaluated).toEqual(runJq({ items }, printed));
        },
      ),
      { numRuns: 200, seed: 47 },
    );
  });
});
