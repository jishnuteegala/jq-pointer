import { describe, expect, it } from "vitest";
import { buildPathModel, pathTo } from "./path-model";
import {
  evaluateExpression,
  evaluateJqExpression,
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
    expect(printKey("and")).toBe('."and"');
    expect(printKey("null")).toBe('."null"');
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
    const values = evaluateJqExpression(buildPathModel(document).root, expression).map(
      (node) => node.value,
    );
    expect(values).toEqual(["first", "second"]);
  });

  it("prints and evaluates chained keys with jq separators", () => {
    const expression = parseExpression('."face 😀".value');
    if (expression === null) throw new Error("expression did not parse");
    expect(printExpression(expression)).toBe('."face 😀".value');
    expect(
      evaluateJqExpression(buildPathModel(document).root, expression).map((node) => node.value),
    ).toEqual([true]);
  });

  it("evaluates parsed flat construction shorthand to field nodes", () => {
    const expression = parseExpression('.items[] | {name, "a-b"}');
    if (expression === null) throw new Error("expression did not parse");
    const values = evaluateJqExpression(buildPathModel(document).root, expression).map(
      (node) => node.value,
    );
    expect(values).toEqual(["first", 1, "second", 2]);
  });

  it("keeps missing construction fields out of reverse-highlight matches", () => {
    const expression = parseExpression('.items[] | {name, "a-b"}');
    if (expression === null) throw new Error("expression did not parse");
    expect(
      evaluateExpression(
        buildPathModel({ items: [{ name: "first" }, { "a-b": 2 }] }).root,
        expression,
      ).map((node) => node.value),
    ).toEqual(["first", 2]);
  });

  it("parses construction keys containing the construction delimiter", () => {
    const expression = parseExpression('.items[] | {"x | {y"}');
    expect(expression).toEqual({
      kind: "construction",
      source: { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
      keys: ["x | {y"],
    });
  });

  it("round-trips paths generated from every addressable model node", () => {
    const model = buildPathModel(document);
    const nodes = [
      model.root,
      ...(model.root.children ?? []),
      ...(model.root.children?.[0].children ?? []).flatMap((item) => item.children ?? []),
    ];
    for (const modelNode of nodes.filter((candidate) => candidate.jqAddressable)) {
      const result = pathTo(modelNode);
      if (result.kind === "unsupported") throw new Error("addressable node did not have a path");
      const source: JqExpression = { kind: "path", steps: result.segments };
      const printed = printExpression(source);
      const parsed = parseExpression(printed);
      if (parsed === null) throw new Error("generated expression did not parse");
      expect(evaluateExpression(model.root, parsed)).toEqual([modelNode]);
      expect(printExpression(parsed)).toBe(printed);
    }
  });

  it("rejects expressions outside the shared grammar", () => {
    expect(parseExpression(".items | map(.name)")).toBeNull();
    expect(parseExpression(".items[0:1]")).toBeNull();
    expect(parseExpression(".items | {name: .name}")).toBeNull();
    expect(parseExpression(". | {name id}")).toBeNull();
    expect(parseExpression(". | {name, }")).toBeNull();
    expect(parseExpression('."\\ud800"')).toBeNull();
    expect(parseExpression('.foo"bar"')).toBeNull();
    expect(parseExpression('."a""b"')).toBeNull();
    expect(parseExpression("..foo")).toBeNull();
    expect(parseExpression(".[9007199254740992]")).toBeNull();
    expect(parseExpression(".if")).toBeNull();
    expect(parseExpression('."name"')).toBeNull();
    expect(parseExpression('."a\\u002db"')).toBeNull();
    expect(parseExpression('."\\ud83d\\ude00"')).toBeNull();
    expect(parseExpression('. | {"name"}')).toBeNull();
    expect(parseExpression(". | {if}")).toBeNull();
    expect(parseExpression(".[01]")).toBeNull();
    expect(parseExpression(".[-0]")).toBeNull();
    expect(parseExpression(". | {name, name}")).toBeNull();
  });

  it("prints root array paths with their required dot prefix", () => {
    expect(printPath([{ kind: "index", index: 0 }])).toBe(".[0]");
    expect(printPath([{ kind: "iterate" }])).toBe(".[]");
  });

  it.each([1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects non-safe integer index %s",
    (index) => {
      expect(() => printPath([{ kind: "index", index }])).toThrow("safe integers");
    },
  );
});
