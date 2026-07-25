import { describe, expect, it } from "vitest";
import { generaliseClickPair } from "./click-pair";
import { printPath } from "./jq-expression";
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

function pair(
  doc: JsonValue,
  a: (root: ModelNode) => ModelNode,
  b: (root: ModelNode) => ModelNode,
) {
  const model = buildPathModel(doc);
  const result = generaliseClickPair(a(model.root), b(model.root));
  if (result === null) throw new Error("expected generalisation");
  return result;
}

describe("generaliseClickPair", () => {
  it("generalises same key-path across sibling array elements", () => {
    const doc: JsonValue = { items: [{ name: "a" }, { name: "b" }] };
    const result = pair(
      doc,
      (root) => child(at(child(root, "items"), 0), "name"),
      (root) => child(at(child(root, "items"), 1), "name"),
    );
    expect(printPath(result.expression.steps)).toBe(".items[].name");
    expect(result.heterogeneous).toBe(false);
  });

  it("generalises scalar siblings to the bare iterator", () => {
    const doc: JsonValue = { arr: [10, 20, 30] };
    const result = pair(
      doc,
      (root) => at(child(root, "arr"), 0),
      (root) => at(child(root, "arr"), 1),
    );
    expect(printPath(result.expression.steps)).toBe(".arr[]");
    expect(result.matchCount).toBe(3);
    expect(result.elementCount).toBe(3);
  });

  it("returns null when the two clicks are the same element", () => {
    const doc: JsonValue = { arr: [10, 20] };
    const model = buildPathModel(doc);
    const node = at(child(model.root, "arr"), 0);
    expect(generaliseClickPair(node, node)).toBeNull();
  });
});

describe("heterogeneity handling", () => {
  it("emits the plain form and no note when every element matches", () => {
    const doc: JsonValue = { items: [{ name: "a" }, { name: "b" }, { name: null }] };
    const result = pair(
      doc,
      (root) => child(at(child(root, "items"), 0), "name"),
      (root) => child(at(child(root, "items"), 1), "name"),
    );
    expect(printPath(result.expression.steps)).toBe(".items[].name");
    expect(result.heterogeneous).toBe(false);
    expect(result.matchCount).toBe(3);
  });

  it("applies ? at the iterator level when elements are non-objects", () => {
    const doc: JsonValue = { items: [{ name: "a" }, 5, { name: "c" }] };
    const result = pair(
      doc,
      (root) => child(at(child(root, "items"), 0), "name"),
      (root) => child(at(child(root, "items"), 2), "name"),
    );
    expect(printPath(result.expression.steps)).toBe(".items[].name?");
    expect(result.heterogeneous).toBe(true);
    expect(result.matchCount).toBe(2);
    expect(result.elementCount).toBe(3);
  });

  it("counts null as present and absent keys as absent", () => {
    const doc: JsonValue = { items: [{ name: null }, {}, { name: "c" }] };
    const result = pair(
      doc,
      (root) => child(at(child(root, "items"), 0), "name"),
      (root) => child(at(child(root, "items"), 2), "name"),
    );
    expect(printPath(result.expression.steps)).toBe(".items[].name");
    expect(result.matchCount).toBe(2);
    expect(result.elementCount).toBe(3);
    expect(result.heterogeneous).toBe(true);
  });

  it("generalises divergent nested indices to nested iterators", () => {
    const doc: JsonValue = {
      data: [{ items: [{ name: "a" }, { name: "b" }] }, { items: [{ name: "c" }] }],
    };
    const result = pair(
      doc,
      (root) => child(at(child(at(child(root, "data"), 0), "items"), 1), "name"),
      (root) => child(at(child(at(child(root, "data"), 1), "items"), 0), "name"),
    );
    expect(printPath(result.expression.steps)).toBe(".data[].items[].name");
    expect(result.matchCount).toBe(2);
    expect(result.elementCount).toBe(2);
  });

  it("applies ? at each mismatching nested iterator level", () => {
    const doc: JsonValue = {
      items: [{ children: [{ value: "a" }] }, { children: "x" }, { children: [{ value: "b" }] }],
    };
    const result = pair(
      doc,
      (root) => child(at(child(at(child(root, "items"), 0), "children"), 0), "value"),
      (root) => child(at(child(at(child(root, "items"), 2), "children"), 0), "value"),
    );
    expect(printPath(result.expression.steps)).toBe(".items[].children[0]?.value");
  });
});
