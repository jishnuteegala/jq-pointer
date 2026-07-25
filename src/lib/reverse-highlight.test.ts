import { describe, expect, it } from "vitest";
import { printExpression, type JqExpression } from "./jq-expression";
import { buildPathModel, pathTo, type ModelNode } from "./path-model";
import { reverseHighlight } from "./reverse-highlight";

describe("reverseHighlight", () => {
  const model = buildPathModel({
    items: [
      { name: "first", id: 1 },
      { name: "second", id: 2 },
    ],
  });

  it("returns empty for blank input", () => {
    expect(reverseHighlight(model.root, "")).toEqual({ kind: "empty" });
    expect(reverseHighlight(model.root, "   ")).toEqual({ kind: "empty" });
  });

  it("highlights the node set an iterator path selects", () => {
    const result = reverseHighlight(model.root, ".items[].name");
    if (result.kind !== "match") throw new Error("expected a match");
    expect(result.nodes.map((node) => node.value)).toEqual(["first", "second"]);
  });

  it("highlights construction field nodes", () => {
    const result = reverseHighlight(model.root, ".items[] | {name, id}");
    if (result.kind !== "match") throw new Error("expected a match");
    expect(result.nodes.map((node) => node.value)).toEqual(["first", 1, "second", 2]);
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = reverseHighlight(model.root, "  .items[0].name\n");
    if (result.kind !== "match") throw new Error("expected a match");
    expect(result.nodes.map((node) => node.value)).toEqual(["first"]);
  });

  it("reports expressions outside the shared grammar as unsupported", () => {
    expect(reverseHighlight(model.root, ".items | map(.name)")).toEqual({ kind: "unsupported" });
    expect(reverseHighlight(model.root, "select(.id == 1)")).toEqual({ kind: "unsupported" });
    expect(reverseHighlight(model.root, ".items[] | .name")).toEqual({ kind: "unsupported" });
    expect(reverseHighlight(model.root, "if .a then .b else .c end")).toEqual({
      kind: "unsupported",
    });
  });

  it("reports jq runtime type errors instead of a wrong highlight", () => {
    expect(reverseHighlight(model.root, ".items[0].name[]")).toEqual({ kind: "runtime-error" });
    expect(reverseHighlight(model.root, ".items.name")).toEqual({ kind: "runtime-error" });
  });

  it("round-trips every generated single-node path to exactly that node instance", () => {
    const documentModel = buildPathModel({
      "face \u{1F600}": { "a-b": [null, { if: [1, "x"] }] },
      arr: [[7, 7], [7]],
      dup: 7,
      "": { " ": true },
    });
    const nodes: ModelNode[] = [documentModel.root];
    for (let index = 0; index < nodes.length; index++) nodes.push(...(nodes[index].children ?? []));
    for (const node of nodes) {
      const result = pathTo(node);
      if (result.kind === "unsupported") throw new Error("unexpected unsupported path");
      const printed = printExpression({ kind: "path", steps: result.segments });
      const highlight = reverseHighlight(documentModel.root, printed);
      if (highlight.kind !== "match") throw new Error(`no match for ${printed}`);
      expect(highlight.nodes).toHaveLength(1);
      expect(highlight.nodes[0]).toBe(node);
    }
  });

  it("round-trips generated iterator and construction expressions to the exact node instances", () => {
    const documentModel = buildPathModel({
      items: [{ "a-b": 7, name: "x" }, { name: "x" }, 7],
    });
    const items = documentModel.root.children?.[0];
    const first = items?.children?.[0];
    const second = items?.children?.[1];
    if (items === undefined || first === undefined || second === undefined)
      throw new Error("missing nodes");

    const iterator: JqExpression = {
      kind: "path",
      steps: [
        { kind: "key", key: "items" },
        { kind: "iterate" },
        { kind: "key", key: "name", optional: true },
      ],
    };
    const iterated = reverseHighlight(documentModel.root, printExpression(iterator));
    if (iterated.kind !== "match") throw new Error("expected a match");
    expect(iterated.nodes).toHaveLength(2);
    expect(iterated.nodes[0]).toBe(first.children?.[1]);
    expect(iterated.nodes[1]).toBe(second.children?.[0]);

    const construction: JqExpression = {
      kind: "construction",
      source: {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "index", index: 0 },
        ],
      },
      keys: ["a-b", "name"],
    };
    const constructed = reverseHighlight(documentModel.root, printExpression(construction));
    if (constructed.kind !== "match") throw new Error("expected a match");
    expect(constructed.nodes).toHaveLength(2);
    expect(constructed.nodes[0]).toBe(first.children?.[0]);
    expect(constructed.nodes[1]).toBe(first.children?.[1]);
  });

  it("reports construction over a scalar element as a runtime error like jq", () => {
    const scalarModel = buildPathModel({ items: [7] });
    expect(reverseHighlight(scalarModel.root, ".items[] | {name}")).toEqual({
      kind: "runtime-error",
    });
  });

  it.each<[JqExpression, unknown[]]>([
    [
      { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
      [
        { name: "first", id: 1 },
        { name: "second", id: 2 },
      ],
    ],
    [
      {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate", optional: true },
          { kind: "key", key: "name", optional: true },
        ],
      },
      ["first", "second"],
    ],
    [
      {
        kind: "construction",
        source: { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
        keys: ["name", "id"],
      },
      ["first", 1, "second", 2],
    ],
  ])("round-trips the generated expression %#", (expression, values) => {
    const highlight = reverseHighlight(model.root, printExpression(expression));
    if (highlight.kind !== "match") throw new Error("expected a match");
    expect(highlight.nodes.map((node) => node.value)).toEqual(values);
  });

  it("returns an empty match set for absent keys rather than an error", () => {
    const result = reverseHighlight(model.root, ".missing");
    if (result.kind !== "match") throw new Error("expected a match");
    expect(result.nodes).toEqual([]);
  });
});
