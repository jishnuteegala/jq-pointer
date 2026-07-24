import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import {
  array,
  assert,
  boolean,
  constantFrom,
  integer,
  jsonValue,
  oneof,
  property,
  string,
  subarray,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";
import {
  evaluateJqExpression,
  parseExpression,
  printExpression,
  printPath,
  type JqExpression,
} from "./jq-expression";
import type { JsonValue } from "./json-value";
import { buildPathModel, pathTo } from "./path-model";

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
    expect(
      runJq({ items: [1, { child: { value: "a" } }, { child: 2 }] }, ".items[].child?.value?"),
    ).toEqual(["a"]);
    expect(
      runJq({ items: [1, { child: [{ value: "a" }] }, { child: 2 }] }, ".items[].child?[]?.value?"),
    ).toEqual(["a"]);
  });

  it("matches jq for parsed paths", () => {
    const document = {
      items: [
        { name: "a", "a-b": 1, "face 😀": true },
        { name: "b", "a-b": 2, "face 😀": false },
      ],
    };
    const expression: JqExpression = {
      kind: "path",
      steps: [{ kind: "key", key: "items" }, { kind: "iterate" }, { kind: "key", key: "face 😀" }],
    };
    const printed = printExpression(expression);
    const parsed = parseExpression(printed);
    if (parsed === null) throw new Error("printed expression did not parse");
    expect(
      evaluateJqExpression(buildPathModel(document).root, parsed).map((node) => node.value),
    ).toEqual(runJq(document, printed));
  });

  it("matches jq semantic results for generated heterogeneous documents and paths", () => {
    const step = oneof(
      constantFrom("name", "a-b", "child", "nested", "value", "missing").map(
        (key) => ({ kind: "key", key, optional: true }) as const,
      ),
      constantFrom({ kind: "iterate", optional: true } as const),
      integer({ min: -2, max: 2 }).map(
        (index) => ({ kind: "index", index, optional: true }) as const,
      ),
    );
    assert(
      property(
        array(
          jsonValue({ maxDepth: 3 }).map((value) => value as JsonValue),
          { maxLength: 8 },
        ),
        array(step, { minLength: 1, maxLength: 5 }),
        (items, suffix) => {
          const document = { items };
          const expression: JqExpression = {
            kind: "path",
            steps: [{ kind: "key", key: "items" }, { kind: "iterate", optional: true }, ...suffix],
          };
          const printed = printExpression(expression);
          const parsed = parseExpression(printed);
          if (parsed === null) throw new Error("printed expression did not parse");
          expect(
            evaluateJqExpression(buildPathModel(document).root, parsed).map((node) => node.value),
          ).toEqual(runJq(document, printed));
        },
      ),
      { numRuns: 100, seed: 17 },
    );
  });

  it("matches jq for generated flat constructions with null and missing fields", () => {
    const constructionKeys = ["name", "a-b", "nested", "if"] as const;
    assert(
      property(
        array(
          tuple(
            boolean(),
            boolean(),
            boolean(),
            boolean(),
            jsonValue({ maxDepth: 3 }).map((value) => value as JsonValue),
          ).map(([hasName, hasDashedKey, hasNested, hasKeyword, value]) => {
            const item: Record<string, JsonValue> = {};
            if (hasName) item.name = value;
            if (hasDashedKey) item["a-b"] = null;
            if (hasNested) item.nested = { value };
            if (hasKeyword) item.if = value;
            return item;
          }),
          { maxLength: 8 },
        ),
        subarray([...constructionKeys], { minLength: 1 }),
        (items, keys) => {
          const document = { items };
          const expression: JqExpression = {
            kind: "construction",
            source: {
              kind: "path",
              steps: [
                { kind: "key", key: "items" },
                { kind: "iterate", optional: true },
              ],
            },
            keys,
          };
          const printed = printExpression(expression);
          expect(parseExpression(printed)).toEqual(expression);
          expect(runJq(document, printed)).toEqual(
            items.map((item) => Object.fromEntries(keys.map((key) => [key, item[key] ?? null]))),
          );
        },
      ),
      { numRuns: 100, seed: 23 },
    );
  });

  it("matches jq for paths generated from selected model nodes", () => {
    const document = { items: [{ name: "a" }, { name: "b" }], meta: { "a-b": true } };
    const model = buildPathModel(document);
    const selected = [
      model.root.children?.[0].children?.[0].children?.[0],
      model.root.children?.[0].children?.[1].children?.[0],
      model.root.children?.[1].children?.[0],
    ];
    for (const node of selected) {
      if (node === undefined) throw new Error("selected node missing from model");
      const result = pathTo(node);
      if (result.kind === "unsupported") throw new Error("selected node is not jq-addressable");
      const expression = printPath(result.segments);
      const parsed = parseExpression(expression);
      if (parsed === null) throw new Error("generated expression did not parse");
      expect(
        evaluateJqExpression(model.root, parsed).map((matchedNode) => matchedNode.value),
      ).toEqual([node.value]);
      expect(runJq(document, expression)).toEqual([node.value]);
    }
  });

  it("prints flat constructions jq evaluates as objects", () => {
    const document = {
      items: [
        { name: "a", "a-b": 1 },
        { name: "b", "a-b": 2 },
      ],
    };
    const expression: JqExpression = {
      kind: "construction",
      source: { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
      keys: ["name", "a-b"],
    };
    const printed = printExpression(expression);
    expect(parseExpression(printed)).toEqual(expression);
    expect(runJq(document, printed)).toEqual([
      { name: "a", "a-b": 1 },
      { name: "b", "a-b": 2 },
    ]);
  });
});
