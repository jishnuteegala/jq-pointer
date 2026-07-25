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
});
