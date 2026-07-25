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

  it("round-trips every generated single-node path to exactly that node", () => {
    const documentModel = buildPathModel({
      "face \u{1F600}": { "a-b": [null, { if: [1, "x"] }] },
      arr: [[0, 1], []],
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
      expect(highlight.nodes).toEqual([node]);
    }
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
