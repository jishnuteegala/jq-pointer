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
    const r = root({
      items: [
        { name: "a", id: 1 },
        { name: "b", id: 2 },
      ],
    });
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
    const r = root({
      items: [
        { name: "a", id: 1 },
        { name: "b", id: 2 },
      ],
    });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(selection.outputs[0].matches.map((node) => node.value)).toEqual(["a", 1, "b", 2]);
  });

  it("constructs from a non-array object with the plain source", () => {
    const r = root({ name: "a", id: 1, extra: 2 });
    const selection = resolveSelection([child(r, "name"), child(r, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(". | {name, id}");
  });

  it("constructs from a nested object with its key path", () => {
    const r = root({ record: { name: "a", id: 1 } });
    const record = child(r, "record");
    const selection = resolveSelection([child(record, "name"), child(record, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".record | {name, id}");
  });

  it("emits the optional construction form when the array is heterogeneous", () => {
    const r = root({ items: [{ name: "a", id: 1 }, 5] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[] | {name, id}?");
    expect(selection.outputs[0].heterogeneous).toBe(true);
    expect(selection.outputs[0].matchCount).toBe(1);
    expect(selection.outputs[0].elementCount).toBe(2);
  });

  it("keeps the plain form when otherwise-object elements are missing selected keys", () => {
    const r = root({ items: [{ name: "a", id: 1 }, { name: "b" }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[] | {name, id}");
    expect(selection.outputs[0].heterogeneous).toBe(false);
    expect(selection.outputs[0].matchCount).toBe(2);
  });

  it("treats a present-null selected key as a matching object", () => {
    const r = root({
      items: [
        { name: "a", id: 1 },
        { name: null, id: null },
      ],
    });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[] | {name, id}");
    expect(selection.outputs[0].heterogeneous).toBe(false);
  });

  it("iterates only over homogeneous object arrays", () => {
    const r = root({
      items: [
        { name: "a", id: 1 },
        { name: "b", id: 2 },
      ],
    });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "name"), child(element, "id")]);
    expect(printExpression(selection.outputs[0].expression)).toBe(".items[] | {name, id}");
    expect(selection.outputs[0].heterogeneous).toBe(false);
  });

  it("preserves representable outputs and flags a lone-surrogate key", () => {
    const r = root({ items: [{ "\ud800": 1, id: 2 }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "\ud800"), child(element, "id")]);
    expect(selection.noCommonPattern).toBe(true);
    expect(selection.unsupportedCount).toBe(1);
    expect(selection.outputs.map((o) => printExpression(o.expression))).toEqual([".items[0].id"]);
  });

  it("reports every click as unsupported when none can be expressed", () => {
    const r = root({ items: [{ "\ud800": 1, "\udc00": 2 }] });
    const element = at(child(r, "items"), 0);
    const selection = resolveSelection([child(element, "\ud800"), child(element, "\udc00")]);
    expect(selection.outputs).toHaveLength(0);
    expect(selection.unsupportedCount).toBe(2);
  });
});

describe("resolveSelection widening across unsafe intermediates", () => {
  it("applies ? at the inner iterator when a widened intermediate is null", () => {
    const r = root({ data: [{ items: [{ v: 1 }, { v: 2 }] }, { items: null }] });
    const clicks = [
      child(at(child(at(child(r, "data"), 0), "items"), 0), "v"),
      child(at(child(at(child(r, "data"), 0), "items"), 1), "v"),
    ];
    const selection = resolveSelectionAt(clicks, 1);
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[].items[]?.v");
  });

  it("does not crash widening construction across a null intermediate", () => {
    const r = root({ data: [{ items: [{ a: 1, b: 2 }] }, { items: null }] });
    const inner = at(child(at(child(r, "data"), 0), "items"), 0);
    const selection = resolveSelectionAt([child(inner, "a"), child(inner, "b")], 1);
    expect(selection.outputs[0].expression.kind).toBe("construction");
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[].items[]? | {a, b}?");
  });

  it("does not crash widening construction across a scalar intermediate", () => {
    const r = root({ data: [{ items: [{ a: 1, b: 2 }] }, { items: 5 }] });
    const inner = at(child(at(child(r, "data"), 0), "items"), 0);
    const selection = resolveSelectionAt([child(inner, "a"), child(inner, "b")], 1);
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[].items[]? | {a, b}?");
  });

  it("does not crash widening construction across a missing intermediate", () => {
    const r = root({ data: [{ items: [{ a: 1, b: 2 }] }, { other: 3 }] });
    const inner = at(child(at(child(r, "data"), 0), "items"), 0);
    const selection = resolveSelectionAt([child(inner, "a"), child(inner, "b")], 1);
    expect(selection.outputs[0].expression.kind).toBe("construction");
    expect(printExpression(selection.outputs[0].expression)).toBe(".data[].items?[]? | {a, b}?");
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
    data: [{ items: [{ name: "a" }, { name: "b" }] }, { items: [{ name: "c" }] }],
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
