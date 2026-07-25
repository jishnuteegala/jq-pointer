import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, UIEvent } from "react";
import type { ModelNode } from "../lib/path-model";
import { rowLabel, valuePreview, visibleTree, type TreeRow } from "../lib/tree-rows";
import { computeWindow, scrollTopForRow } from "../lib/virtual-scroll";

const ROW_HEIGHT = 28;
const OVERSCAN = 10;
const INITIAL_VIEWPORT = 480;

interface TreeViewProps {
  root: ModelNode;
  highlighted: ReadonlySet<ModelNode>;
  onSelect: (node: ModelNode) => void;
}

export function TreeView({ root, highlighted, onSelect }: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<ModelNode>>(() => new Set([root]));

  useEffect(() => {
    setExpanded((previous) => {
      let next: Set<ModelNode> | null = null;
      for (const node of highlighted) {
        let ancestor = node.parent;
        while (ancestor !== null) {
          if (!(next ?? previous).has(ancestor)) {
            next ??= new Set(previous);
            next.add(ancestor);
          }
          ancestor = ancestor.parent;
        }
      }
      return next ?? previous;
    });
  }, [highlighted]);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(INITIAL_VIEWPORT);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedNodeRef = useRef<ModelNode | null>(null);
  const treeId = useId();
  const tree = useMemo(() => visibleTree(root, expanded), [root, expanded]);

  useEffect(() => {
    const node = focusedNodeRef.current;
    if (node === null) return;
    let ancestor = node.parent;
    while (ancestor !== null) {
      if (!expanded.has(ancestor)) return;
      ancestor = ancestor.parent;
    }
    const index = tree.indexOf(node);
    setFocusedIndex((previous) => (previous === index ? previous : index));
  }, [tree, expanded]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    setViewportHeight(container.clientHeight);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setViewportHeight(entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { spacerHeight, start, end, offsetFor } = computeWindow(
    tree.total,
    ROW_HEIGHT,
    scrollTop,
    viewportHeight,
    OVERSCAN,
  );
  const windowRows = useMemo(() => tree.window(start, end), [tree, start, end]);
  const focusVisible = focusedIndex >= start && focusedIndex < end;
  const pinnedRow = useMemo(
    () => (focusVisible ? undefined : tree.rowAt(focusedIndex)),
    [focusVisible, tree, focusedIndex],
  );

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
    focusedNodeRef.current = tree.rowAt(clamped)?.node ?? null;
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

  const expand = (node: ModelNode) => {
    setExpanded((previous) => {
      if (previous.has(node)) return previous;
      const next = new Set(previous);
      next.add(node);
      return next;
    });
  };

  const activateRow = (row: TreeRow) => {
    if (row.expandable) expand(row.node);
    onSelect(row.node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      focusRow(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusRow(tree.total - 1);
      return;
    }
    if (
      !focusVisible &&
      (event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      const above = focusedIndex < start;
      if (event.key === "ArrowUp") focusRow(above ? focusedIndex : end - 1);
      else if (event.key === "ArrowDown") focusRow(above ? start : focusedIndex);
      else focusRow(above ? start : end - 1);
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
      else if (row.expandable && row.expanded) focusRow(focusedIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.expandable && row.expanded) toggle(row.node);
      else if (row.node.parent !== null) focusRow(tree.indexOf(row.node.parent));
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRow(tree.total - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateRow(row);
    }
  };

  const renderRow = (row: TreeRow, index: number) => {
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
        {row.expandable ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={`${row.expanded ? "Collapse" : "Expand"} ${rowLabel(row.node)}`}
            aria-expanded={row.expanded}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              focusRow(index);
              toggle(row.node);
            }}
          >
            {row.expanded ? "\u25be" : "\u25b8"}
          </button>
        ) : (
          <span className="tree-toggle" aria-hidden="true" />
        )}
        <span className="tree-label">{rowLabel(row.node)}</span>
        <span className="tree-value">{valuePreview(row.node)}</span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="tree-view"
      role="tree"
      aria-label="JSON document tree"
      aria-multiselectable="true"
      aria-activedescendant={`${treeId}-row-${focusedIndex}`}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <div className="tree-spacer" style={{ height: spacerHeight }}>
        {windowRows.map((row, offset) => renderRow(row, start + offset))}
        {pinnedRow !== undefined && renderRow(pinnedRow, focusedIndex)}
      </div>
    </div>
  );
}
