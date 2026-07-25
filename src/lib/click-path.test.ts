import { describe, expect, it } from "vitest";
import { printPath } from "./jq-expression";
import { buildPathModel, pathTo, type ModelNode } from "./path-model";
import type { JsonValue } from "./json-value";

const doc: JsonValue = {
  arr: [10, 20, 30],
  "foo-bar": { baz: true },
  items: [{ "created-at": "now" }],
};

function descend(node: ModelNode, path: (string | number)[]): ModelNode {
  let current = node;
  for (const part of path) {
    const found =
      typeof part === "number"
        ? current.children?.[part]
        : current.children?.find((c) => c.segment?.kind === "key" && c.segment.key === part);
    if (found === undefined) throw new Error(`missing ${String(part)}`);
    current = found;
  }
  return current;
}

function clickPath(node: ModelNode): string {
  const result = pathTo(node);
  if (result.kind !== "path") throw new Error(result.reason);
  return printPath(result.segments);
}

describe("single-click path generation", () => {
  const model = buildPathModel(doc);

  it("yields the indexed path for a scalar array element", () => {
    expect(clickPath(descend(model.root, ["arr", 0]))).toBe(".arr[0]");
    expect(clickPath(descend(model.root, ["arr", 2]))).toBe(".arr[2]");
  });

  it("yields the top-level dot for the root", () => {
    expect(clickPath(model.root)).toBe(".");
  });

  it("quotes non-identifier keys", () => {
    expect(clickPath(descend(model.root, ["foo-bar", "baz"]))).toBe('."foo-bar".baz');
    expect(clickPath(descend(model.root, ["items", 0, "created-at"]))).toBe(
      '.items[0]."created-at"',
    );
  });
});
