import { useEffect, useRef, useState } from "react";
import type { ModelNode } from "../lib/path-model";
import { nodeLabel, valuePreview, visibleTreeRows } from "../lib/tree-rows";

const ROW_HEIGHT = 32;
const OVERSCAN = 8;

interface TreeViewProps {
  root: ModelNode;
  selected: ModelNode | null;
  onSelect: (node: ModelNode) => void;
}

export function TreeView({ root, selected, onSelect }: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<ModelNode>>(() => new Set([root]));
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const rows = visibleTreeRows(root, expanded);
  const visibleCount = Math.ceil((viewport.current?.clientHeight ?? 384) / ROW_HEIGHT);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, start + visibleCount + OVERSCAN * 2);

  useEffect(() => {
    setExpanded(new Set([root]));
    setScrollTop(0);
    viewport.current?.scrollTo({ top: 0 });
  }, [root]);

  function toggle(node: ModelNode) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node)) next.delete(node);
      else next.add(node);
      return next;
    });
  }

  return (
    <div aria-label="JSON tree" className="tree-viewport" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} ref={viewport} role="tree" tabIndex={0}>
      <div className="tree-spacer" style={{ height: rows.length * ROW_HEIGHT }}>
        <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
          {rows.slice(start, end).map(({ node, depth }, index) => {
            const branch = node.children !== null;
            const isExpanded = expanded.has(node);
            return <div aria-level={depth + 1} aria-selected={selected === node} className={`tree-row${selected === node ? " is-selected" : ""}`} key={start + index} role="treeitem" style={{ height: ROW_HEIGHT, paddingLeft: `${depth * 20 + 8}px` }}>
              <button aria-label={`${isExpanded ? "Collapse" : "Expand"} ${nodeLabel(node)}`} className="tree-toggle" disabled={!branch} onClick={() => toggle(node)} type="button">{branch ? (isExpanded ? "-" : "+") : ""}</button>
              <button className="tree-value" onClick={() => onSelect(node)} type="button"><span className="tree-key">{nodeLabel(node)}</span><span className="tree-preview">{valuePreview(node)}</span></button>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
