import { describe, expect, it } from "vitest";
import { buildPathModel } from "./path-model";
import { nodeLabel, valuePreview, visibleTreeRows } from "./tree-rows";

describe("visibleTreeRows", () => {
  it("includes expanded branches in document order", () => {
    const model = buildPathModel({ object: { leaf: true }, list: [1] });
    const object = model.root.children?.[0];
    expect(object).toBeDefined();
    if (object === undefined) throw new Error("missing object node");
    expect(visibleTreeRows(model.root, new Set([model.root, object])).map(({ node }) => nodeLabel(node))).toEqual([
      "root", "object", "leaf", "list",
    ]);
  });

  it("renders compact JSON previews", () => {
    const children = buildPathModel({ object: {}, list: [1, 2], text: "hello" }).root.children ?? [];
    expect(children.map(valuePreview)).toEqual(["{0}", "[2]", '"hello"']);
  });
});
