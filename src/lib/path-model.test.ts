import { describe, expect, it } from "vitest";
import {
  buildPathModel,
  commonArrayAncestor,
  evaluateSteps,
  pathTo,
  type ModelNode,
} from "./path-model";
import type { JsonValue } from "./json-value";

const doc: JsonValue = {
  items: [
    { name: "a", meta: { id: 1 } },
    { name: "b", meta: { id: 2 } },
  ],
  scalars: [10, 20, 30],
  empty: {},
};

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

describe("buildPathModel", () => {
  it("counts every node exactly once", () => {
    const model = buildPathModel(doc);
    expect(model.nodeCount).toBe(15);
  });

  it("handles scalar roots", () => {
    const model = buildPathModel(42);
    expect(model.nodeCount).toBe(1);
    expect(model.root.children).toBeNull();
  });

  it("records parent and segment links", () => {
    const model = buildPathModel(doc);
    const name = child(at(child(model.root, "items"), 1), "name");
    expect(name.value).toBe("b");
    expect(pathTo(name)).toEqual([
      { kind: "key", key: "items" },
      { kind: "index", index: 1 },
      { kind: "key", key: "name" },
    ]);
  });
});

describe("evaluateSteps", () => {
  it("follows keys and indices", () => {
    const model = buildPathModel(doc);
    const results = evaluateSteps(model.root, [
      { kind: "key", key: "items" },
      { kind: "index", index: 0 },
      { kind: "key", key: "name" },
    ]);
    expect(results.map((n) => n.value)).toEqual(["a"]);
  });

  it("iterates arrays", () => {
    const model = buildPathModel(doc);
    const results = evaluateSteps(model.root, [
      { kind: "key", key: "items" },
      { kind: "iterate" },
      { kind: "key", key: "meta" },
      { kind: "key", key: "id" },
    ]);
    expect(results.map((n) => n.value)).toEqual([1, 2]);
  });

  it("returns jq nulls for missing keys and out-of-range indices", () => {
    const model = buildPathModel(doc);
    expect(
      evaluateSteps(model.root, [{ kind: "key", key: "nope" }]).map((node) => node.value),
    ).toEqual([null]);
    expect(
      evaluateSteps(model.root, [
        { kind: "key", key: "scalars" },
        { kind: "index", index: 99 },
      ]).map((node) => node.value),
    ).toEqual([null]);
  });

  it("does not index into objects or key into arrays", () => {
    const model = buildPathModel(doc);
    expect(() =>
      evaluateSteps(model.root, [
        { kind: "key", key: "items" },
        { kind: "key", key: "name" },
      ]),
    ).toThrow("cannot index a scalar with a key");
    expect(() => evaluateSteps(model.root, [{ kind: "index", index: 0 }])).toThrow(
      "cannot index a non-array",
    );
  });

  it("applies optional steps only to type errors and supports negative indices", () => {
    const model = buildPathModel({ values: [1, 2], mixed: [{ name: "a" }, 7] });
    expect(
      evaluateSteps(model.root, [
        { kind: "key", key: "values" },
        { kind: "index", index: -1 },
      ]).map((node) => node.value),
    ).toEqual([2]);
    expect(() =>
      evaluateSteps(model.root, [
        { kind: "key", key: "mixed" },
        { kind: "iterate" },
        { kind: "key", key: "name" },
      ]),
    ).toThrow("cannot index a scalar with a key");
    expect(
      evaluateSteps(model.root, [
        { kind: "key", key: "mixed" },
        { kind: "iterate" },
        { kind: "key", key: "name", optional: true },
      ]).map((node) => node.value),
    ).toEqual(["a"]);
  });

  it("treats null indexing as jq null propagation", () => {
    const model = buildPathModel({ value: null });
    expect(
      evaluateSteps(model.root, [
        { kind: "key", key: "value" },
        { kind: "index", index: 0 },
      ]).map((node) => node.value),
    ).toEqual([null]);
  });

  it("preserves documents with keys jq cannot address", () => {
    expect(buildPathModel({ "bad \ud800 key": 1 }).nodeCount).toBe(2);
  });
});

describe("commonArrayAncestor", () => {
  it("finds the shared array for sibling element values", () => {
    const model = buildPathModel(doc);
    const items = child(model.root, "items");
    const a = child(at(items, 0), "name");
    const b = child(at(items, 1), "name");
    expect(commonArrayAncestor(a, b)).toBe(items);
  });

  it("returns null when no array ancestor exists", () => {
    const model = buildPathModel(doc);
    const empty = child(model.root, "empty");
    expect(commonArrayAncestor(empty, model.root)).toBeNull();
  });

  it("walks up past the common object ancestor to the nearest array", () => {
    const nested: JsonValue = { rows: [{ x: { p: 1, q: 2 } }] };
    const model = buildPathModel(nested);
    const rows = child(model.root, "rows");
    const x = child(at(rows, 0), "x");
    expect(commonArrayAncestor(child(x, "p"), child(x, "q"))).toBe(rows);
  });
});
