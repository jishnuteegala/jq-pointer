import { describe, expect, it } from "vitest";
import { buildPathModel, type ModelNode } from "./path-model";
import { flattenVisible, rowLabel, valuePreview, visibleTree } from "./tree-rows";
import type { JsonValue } from "./json-value";

const doc: JsonValue = {
  items: [{ name: "a" }, { name: "b" }],
  empty: [],
  note: "hello",
};

function labels(rows: { node: ModelNode; depth: number }[]): string[] {
  return rows.map((row) => `${row.depth}:${rowLabel(row.node)}`);
}

describe("flattenVisible", () => {
  const model = buildPathModel(doc);

  it("returns only the root when nothing is expanded", () => {
    const rows = flattenVisible(model.root, new Set());
    expect(labels(rows)).toEqual(["0:$"]);
    expect(rows[0].expandable).toBe(true);
    expect(rows[0].expanded).toBe(false);
  });

  it("expands children in document order", () => {
    const rows = flattenVisible(model.root, new Set([model.root]));
    expect(labels(rows)).toEqual(["0:$", "1:items", "1:empty", "1:note"]);
  });

  it("expands nested nodes and marks empty containers unexpandable", () => {
    const items = model.root.children?.[0] as ModelNode;
    const rows = flattenVisible(model.root, new Set([model.root, items]));
    expect(labels(rows)).toEqual(["0:$", "1:items", "2:[0]", "2:[1]", "1:empty", "1:note"]);
    const empty = rows.find((row) => rowLabel(row.node) === "empty");
    expect(empty?.expandable).toBe(false);
  });

  it("tracks position and set size per sibling group", () => {
    const items = model.root.children?.[0] as ModelNode;
    const rows = flattenVisible(model.root, new Set([model.root, items]));
    expect(rows.map((row) => `${row.posInSet}/${row.setSize}`)).toEqual([
      "1/1",
      "1/3",
      "1/2",
      "2/2",
      "2/3",
      "3/3",
    ]);
  });
});

describe("visibleTree", () => {
  const model = buildPathModel(doc);

  it("matches flattenVisible for full windows", () => {
    const items = model.root.children?.[0] as ModelNode;
    const expanded = new Set([model.root, items]);
    const tree = visibleTree(model.root, expanded);
    const flat = flattenVisible(model.root, expanded);
    expect(tree.total).toBe(flat.length);
    expect(tree.window(0, tree.total)).toEqual(flat);
  });

  it("returns only the requested window", () => {
    const items = model.root.children?.[0] as ModelNode;
    const expanded = new Set([model.root, items]);
    const tree = visibleTree(model.root, expanded);
    const window = tree.window(2, 4);
    expect(labels(window)).toEqual(["2:[0]", "2:[1]"]);
    expect(tree.rowAt(5)).toEqual(flattenVisible(model.root, expanded)[5]);
  });

  it("maps nodes back to their visible index", () => {
    const items = model.root.children?.[0] as ModelNode;
    const expanded = new Set([model.root, items]);
    const tree = visibleTree(model.root, expanded);
    const flat = flattenVisible(model.root, expanded);
    for (let index = 0; index < flat.length; index++) {
      expect(tree.indexOf(flat[index].node)).toBe(index);
    }
  });

  it("windows a large scalar array without materialising all rows", () => {
    const big = buildPathModel(Array.from({ length: 100000 }, (_, index) => index));
    const tree = visibleTree(big.root, new Set([big.root]));
    expect(tree.total).toBe(100001);
    const window = tree.window(99990, 100001);
    expect(window).toHaveLength(11);
    expect(labels(window)[10]).toBe("1:[99999]");
  });
});

describe("valuePreview", () => {
  const model = buildPathModel(doc);

  it("summarises containers and prints scalars", () => {
    expect(valuePreview(model.root)).toBe("{3}");
    expect(valuePreview(model.root.children?.[0] as ModelNode)).toBe("[2]");
    expect(valuePreview(model.root.children?.[1] as ModelNode)).toBe("[]");
    expect(valuePreview(model.root.children?.[2] as ModelNode)).toBe('"hello"');
  });

  it("truncates long strings", () => {
    const long = buildPathModel("x".repeat(100));
    expect(valuePreview(long.root)).toBe(`"${"x".repeat(80)}\u2026"`);
  });
});
