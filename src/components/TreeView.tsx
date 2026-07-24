import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, UIEvent } from "react";
import type { ModelNode } from "../lib/path-model";
import { flattenVisible, rowLabel, valuePreview, type TreeRow } from "../lib/tree-rows";

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
  const rows = useMemo(() => flattenVisible(root, expanded), [root, expanded]);

  const viewportHeight = containerRef.current?.clientHeight ?? 480;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
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
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setFocusedIndex(clamped);
    const container = containerRef.current;
    if (container === null) return;
    const top = clamped * ROW_HEIGHT;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (top + ROW_HEIGHT > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + ROW_HEIGHT - container.clientHeight;
    }
  };

  const activateRow = (row: TreeRow) => {
    if (row.expandable) toggle(row.node);
    onSelect(row.node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[focusedIndex];
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
      else {
        const parentIndex = rows.findIndex((candidate) => candidate.node === row.node.parent);
        if (parentIndex !== -1) focusRow(parentIndex);
      }
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
      aria-activedescendant={`${treeId}-row-${focusedIndex}`}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <div className="tree-spacer" style={{ height: rows.length * ROW_HEIGHT }}>
        {rows.slice(start, end).map((row, offset) => {
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
              style={{ top: index * ROW_HEIGHT, paddingLeft: `${row.depth * 1.25 + 0.5}rem` }}
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
