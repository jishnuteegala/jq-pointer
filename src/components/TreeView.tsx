import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, UIEvent } from "react";
import type { ModelNode } from "../lib/path-model";
import { rowLabel, valuePreview, visibleTree, type TreeRow } from "../lib/tree-rows";
import { computeWindow, scrollTopForRow } from "../lib/virtual-scroll";

const ROW_HEIGHT = 28;
const OVERSCAN = 10;

interface TreeViewProps {
  root: ModelNode;
  highlighted: ReadonlySet<ModelNode>;
  onSelect: (node: ModelNode) => void;
}

export function TreeView({ root, highlighted, onSelect }: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<ModelNode>>(() => new Set([root]));
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeId = useId();
  const tree = useMemo(() => visibleTree(root, expanded), [root, expanded]);

  const viewportHeight = containerRef.current?.clientHeight ?? 480;
  const { spacerHeight, start, end, offsetFor } = computeWindow(
    tree.total,
    ROW_HEIGHT,
    scrollTop,
    viewportHeight,
    OVERSCAN,
  );
  const windowRows = useMemo(() => tree.window(start, end), [tree, start, end]);
  const focusVisible = focusedIndex >= start && focusedIndex < end;

  const toggle = (node: ModelNode) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(node)) next.delete(node);
      else next.add(node);
      return next;
    });
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(tree.total - 1, index));
    setFocusedIndex(clamped);
    const container = containerRef.current;
    if (container === null) return;
    const target = scrollTopForRow(
      clamped,
      tree.total,
      ROW_HEIGHT,
      container.scrollTop,
      container.clientHeight,
    );
    if (target !== container.scrollTop) {
      container.scrollTop = target;
      setScrollTop(target);
    }
  };

  const activateRow = (row: TreeRow) => {
    if (row.expandable) toggle(row.node);
    onSelect(row.node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !focusVisible &&
      (event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      focusRow(Math.min(tree.total - 1, start + OVERSCAN));
      return;
    }
    const row = tree.rowAt(focusedIndex);
    if (row === undefined) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(focusedIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(focusedIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (row.expandable && !row.expanded) toggle(row.node);
      else focusRow(focusedIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.expandable && row.expanded) toggle(row.node);
      else if (row.node.parent !== null) focusRow(tree.indexOf(row.node.parent));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateRow(row);
    }
  };

  return (
    <div
      ref={containerRef}
      className="tree-view"
      role="tree"
      aria-label="JSON document tree"
      aria-activedescendant={focusVisible ? `${treeId}-row-${focusedIndex}` : undefined}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <div className="tree-spacer" style={{ height: spacerHeight }}>
        {windowRows.map((row, offset) => {
          const index = start + offset;
          const selected = highlighted.has(row.node);
          return (
            <div
              key={index}
              id={`${treeId}-row-${index}`}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-posinset={row.posInSet}
              aria-setsize={row.setSize}
              aria-expanded={row.expandable ? row.expanded : undefined}
              aria-selected={selected}
              tabIndex={-1}
              className={`tree-row${selected ? " tree-row-highlighted" : ""}${
                index === focusedIndex ? " tree-row-focused" : ""
              }`}
              style={{ top: offsetFor(index), paddingLeft: `${row.depth * 1.25 + 0.5}rem` }}
              onClick={() => {
                focusRow(index);
                activateRow(row);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                handleKeyDown(event);
              }}
            >
              <span className="tree-toggle" aria-hidden="true">
                {row.expandable ? (row.expanded ? "\u25be" : "\u25b8") : ""}
              </span>
              <span className="tree-label">{rowLabel(row.node)}</span>
              <span className="tree-value">{valuePreview(row.node)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
