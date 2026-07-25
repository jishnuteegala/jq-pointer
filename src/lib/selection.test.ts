import { describe, expect, it } from "vitest";
import { resolveSelection, resolveSelectionAt } from "./selection";
import { printExpression } from "./jq-expression";
import { buildPathModel, type ModelNode } from "./path-model";
import type { JsonValue } from "./json-value";

function child(node: ModelNode, key: string): ModelNode {
  const found = node.children?.find((c) => c.segment?.kind === "key" && c.segment.key === key);
  if (found === undefined) throw new Error(`missing key ${key}`);
  return found;
}

function at(node: ModelNode, index: number): ModelNode {
  const found = node.children?.[index];
  if (found === undefined) throw new Error(`missing index ${index}`);
  return found;
}

function root(doc: JsonValue): ModelNode {
  return buildPathModel(doc).root;
}

describe("resolveSelection single and iterator", () => {
  it("resolves a single click to its indexed path", () => {
    const r = root({ arr: [10, 20] });
    const selection = resolveSelection([at(child(r, "arr"), 0)]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".arr[0]");
  });

  it("generalises same key-path across sibling elements", () => {
    const r = root({ items: [{ name: "a" }, { name: "b" }] });
    const selection = resolveSelection([
      child(at(child(r, "items"), 0), "name"),
      child(at(child(r, "items"), 1), "name"),
    ]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[].name");
    expect(selection.noCommonPattern).toBe(false);
  });
});

describe("resolveSelection construction", () => {
  it("builds flat shorthand construction from different keys in one element", () => {
    const r = root({ items: [{ name: "a", id: 1 }, { name: "b", id: 2 }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[] | {name, id}");
  });

  it("quotes non-identifier and digit-leading keys via shorthand", () => {
    const r = root({ items: [{ "a-b": 1, "2fa": 2 }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "a-b"), child(element, "2fa")]);
    expect(printExpression(selection.outputs[0].expression)).toBe('.items[] | {"a-b", "2fa"}');
  });

  it("highlights the constructed field nodes", () => {
    const r = root({ items: [{ name: "a", id: 1 }, { name: "b", id: 2 }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(selection.outputs[0].matches.map((node) => node.value)).toEqual(["a", 1, "b", 2]);
  });
});

describe("resolveSelection no common pattern", () => {
  it("keeps clicks across different arrays as separate outputs", () => {
    const r = root({ a: [1], b: [2] });
    const selection = resolveSelection([at(child(r, "a"), 0), at(child(r, "b"), 0)]);
    expect(selection.noCommonPattern).toBe(true);
    expect(selection.outputs.map((o) => printExpression(o.expression))).toEqual([".a[0]", ".b[0]"]);
  });

  it("keeps different key-paths across elements separate", () => {
    const r = root({ items: [{ x: 1 }, { y: 2 }] });
    const selection = resolveSelection([
      child(at(child(r, "items"), 0), "x"),
      child(at(child(r, "items"), 1), "y"),
    ]);
    expect(selection.noCommonPattern).toBe(true);
  });
});

describe("resolveSelection breadcrumb widening", () => {
  const doc: JsonValue = {
    data: [
      { items: [{ name: "a" }, { name: "b" }] },
      { items: [{ name: "c" }] },
    ],
  };

  it("defaults to the innermost array", () => {
    const r = root(doc);
    const selection = resolveSelection([
      child(at(child(at(child(r, "data"), 0), "items"), 0), "name"),
      child(at(child(at(child(r, "data"), 0), "items"), 1), "name"),
    ]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[0].items[].name");
    expect(selection.breadcrumb?.ancestors).toHaveLength(2);
    expect(selection.breadcrumb?.activeIndex).toBe(0);
  });

  it("widens to an outer array when the index is bumped", () => {
    const clicks = (() => {
      const r = root(doc);
      return [
        child(at(child(at(child(r, "data"), 0), "items"), 0), "name"),
        child(at(child(at(child(r, "data"), 0), "items"), 1), "name"),
      ];
    })();
    const selection = resolveSelectionAt(clicks, 1);
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[].items[].name");
    expect(selection.breadcrumb?.activeIndex).toBe(1);
  });
});
