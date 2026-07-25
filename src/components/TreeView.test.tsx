// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPathModel } from "../lib/path-model";
import { TreeView } from "./TreeView";

afterEach(cleanup);

describe("TreeView active descendant", () => {
  it("keeps aria-activedescendant resolving when the active row scrolls out of the window", () => {
    const { root } = buildPathModel(Array.from({ length: 500 }, (_, index) => index));
    const { container } = render(
      <TreeView root={root} highlighted={new Set()} onSelect={() => {}} />,
    );

    const tree = container.querySelector('[role="tree"]');
    if (tree === null) throw new Error("no tree");

    const activeId = tree.getAttribute("aria-activedescendant");
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId as string)).not.toBeNull();

    fireEvent.scroll(tree, { target: { scrollTop: 8000 } });

    const scrolledId = tree.getAttribute("aria-activedescendant");
    expect(scrolledId).toBe(activeId);
    expect(document.getElementById(scrolledId as string)).not.toBeNull();
  });

  it("keeps the focused node active when auto-expansion shifts row indices", () => {
    const { root } = buildPathModel({ a: { x: 1 }, b: 2 });
    const nodeA = root.children?.[0];
    const nodeX = nodeA?.children?.[0];
    if (nodeA === undefined || nodeX === undefined) throw new Error("missing nodes");
    const { container, rerender } = render(
      <TreeView root={root} highlighted={new Set()} onSelect={() => {}} />,
    );
    const tree = container.querySelector('[role="tree"]');
    if (tree === null) throw new Error("no tree");

    fireEvent.keyDown(tree, { key: "End" });
    const activeId = tree.getAttribute("aria-activedescendant");
    expect(document.getElementById(activeId as string)?.textContent).toContain("b");

    rerender(<TreeView root={root} highlighted={new Set([nodeX])} onSelect={() => {}} />);

    const shiftedId = tree.getAttribute("aria-activedescendant");
    const active = document.getElementById(shiftedId as string);
    expect(active?.textContent).toContain("b");
    expect(container.textContent).toContain("x");
  });

  it("declares multiselectable so multi-node click-pair previews announce correctly", () => {
    const { root } = buildPathModel({ items: [{ name: "a" }, { name: "b" }] });
    const highlighted = new Set(root.children ?? []);
    const { container } = render(
      <TreeView root={root} highlighted={highlighted} onSelect={() => {}} />,
    );
    const tree = container.querySelector('[role="tree"]');
    expect(tree?.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("names each expand control with its row label so they are distinguishable", () => {
    const { root } = buildPathModel({ items: [{ name: "a" }], other: [1] });
    const { container } = render(
      <TreeView root={root} highlighted={new Set()} onSelect={() => {}} />,
    );
    const labels = [...container.querySelectorAll("button.tree-toggle")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toContain("Expand items");
    expect(labels).toContain("Expand other");
  });
});
