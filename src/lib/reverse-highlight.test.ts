import { describe, expect, it } from "vitest";
import { buildPathModel } from "./path-model";
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

  it("returns an empty match set for absent keys rather than an error", () => {
    const result = reverseHighlight(model.root, ".missing");
    if (result.kind !== "match") throw new Error("expected a match");
    expect(result.nodes).toEqual([]);
  });
});
