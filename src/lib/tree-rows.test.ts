import { describe, expect, it } from "vitest";
import { buildPathModel, type ModelNode } from "./path-model";
import { flattenVisible, rowLabel, valuePreview } from "./tree-rows";
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
