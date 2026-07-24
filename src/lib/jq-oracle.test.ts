import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  parseExpression,
  printExpression,
  printPath,
  type JqExpression,
} from "./jq-expression";
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
      runJq({ items: [1, { child: { value: "a" } }, { child: 2 }] }, ".items[].child[]?.value?"),
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
      evaluateExpression(buildPathModel(document).root, parsed).map((node) => node.value),
    ).toEqual(runJq(document, printed));
  });

  it("matches jq semantic results for generated supported paths", () => {
    const document = {
      items: [
        { name: "a", "a-b": 1, nested: { value: true } },
        { name: "b", "a-b": null, nested: { value: false } },
      ],
    };
    const expressions: JqExpression[] = [
      {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "index", index: 0 },
        ],
      },
      {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate", optional: true },
          { kind: "key", key: "a-b", optional: true },
        ],
      },
      {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate" },
          { kind: "key", key: "nested" },
          { kind: "key", key: "value", optional: true },
        ],
      },
    ];
    assert(
      property(constantFrom(...expressions), (expression) => {
        const printed = printExpression(expression);
        const parsed = parseExpression(printed);
        if (parsed === null) throw new Error("printed expression did not parse");
        expect(
          evaluateExpression(buildPathModel(document).root, parsed).map((node) => node.value),
        ).toEqual(runJq(document, printed));
      }),
      { numRuns: 100, seed: 17 },
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
      const steps = pathTo(node);
      if (steps === null) throw new Error("selected node is not jq-addressable");
      const expression = printPath(steps);
      const parsed = parseExpression(expression);
      if (parsed === null) throw new Error("generated expression did not parse");
      expect(evaluateExpression(model.root, parsed).map((result) => result.value)).toEqual([
        node.value,
      ]);
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
