import { describe, expect, it } from "vitest";
import { buildPathModel } from "./path-model";
import {
  evaluateExpression,
  parseExpression,
  printExpression,
  printKey,
  printPath,
  type JqExpression,
} from "./jq-expression";

describe("jq expression printer", () => {
  it("prints canonical jq keys", () => {
    expect(printKey("name")).toBe(".name");
    expect(printKey("if")).toBe('."if"');
    expect(printKey("two words")).toBe('."two words"');
    expect(printKey('x"\\\n')).toBe('."x\\\"\\\\\\n"');
  });

  it("keeps non-BMP characters raw", () => {
    expect(printKey("face 😀")).toBe('."face 😀"');
    expect(printKey("face 😀")).not.toContain("\\ud83d");
  });

  it("does not emit lone surrogate escapes", () => {
    expect(() => printKey("bad \ud800 key")).toThrow("lone surrogates");
  });

  it("prints optional paths and construction shorthand", () => {
    expect(
      printPath([
        { kind: "key", key: "items" },
        { kind: "iterate", optional: true },
      ]),
    ).toBe(".items[]?");
    const expression: JqExpression = {
      kind: "construction",
      source: { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
      keys: ["name", "a-b"],
    };
    expect(printExpression(expression)).toBe('.items[] | {name, "a-b"}');
  });
});

describe("jq expression parser and evaluator", () => {
  const document = {
    items: [
      { name: "first", "a-b": 1 },
      { name: "second", "a-b": 2 },
    ],
    "face 😀": { value: true },
  };

  it("parses every canonical expression it prints", () => {
    const expressions: JqExpression[] = [
      { kind: "path", steps: [] },
      {
        kind: "path",
        steps: [
          { kind: "key", key: "face 😀" },
          { kind: "key", key: "value" },
        ],
      },
      {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate" },
          { kind: "key", key: "name", optional: true },
        ],
      },
    ];
    for (const expression of expressions)
      expect(parseExpression(printExpression(expression))).toEqual(expression);
  });

  it("evaluates parsed iterator paths to their matching nodes", () => {
    const expression = parseExpression(".items[].name");
    if (expression === null) throw new Error("expression did not parse");
    const values = evaluateExpression(buildPathModel(document).root, expression).map(
      (node) => node.value,
    );
    expect(values).toEqual(["first", "second"]);
  });

  it("prints and evaluates chained keys with jq separators", () => {
    const expression = parseExpression('."face 😀".value');
    if (expression === null) throw new Error("expression did not parse");
    expect(printExpression(expression)).toBe('."face 😀".value');
    expect(
      evaluateExpression(buildPathModel(document).root, expression).map((node) => node.value),
    ).toEqual([true]);
  });

  it("evaluates parsed flat construction shorthand to field nodes", () => {
    const expression = parseExpression('.items[] | {name, "a-b"}');
    if (expression === null) throw new Error("expression did not parse");
    const values = evaluateExpression(buildPathModel(document).root, expression).map(
      (node) => node.value,
    );
    expect(values).toEqual(["first", 1, "second", 2]);
  });

  it("round-trips generated paths to the originating node set", () => {
    const model = buildPathModel(document);
    const source: JqExpression = {
      kind: "path",
      steps: [{ kind: "key", key: "items" }, { kind: "iterate" }, { kind: "key", key: "name" }],
    };
    const parsed = parseExpression(printExpression(source));
    if (parsed === null) throw new Error("generated expression did not parse");
    expect(evaluateExpression(model.root, parsed)).toEqual(evaluateExpression(model.root, source));
    expect(printExpression(parsed)).toBe(printExpression(source));
  });

  it("rejects expressions outside the shared grammar", () => {
    expect(parseExpression(".items | map(.name)")).toBeNull();
    expect(parseExpression(".items[0:1]")).toBeNull();
    expect(parseExpression(".items | {name: .name}")).toBeNull();
  });
});
