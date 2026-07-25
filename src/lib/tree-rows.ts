import type { ModelNode } from "./path-model";

export interface TreeRow {
  node: ModelNode;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  posInSet: number;
  setSize: number;
}

interface StackEntry {
  node: ModelNode;
  depth: number;
  posInSet: number;
  setSize: number;
}

export function flattenVisible(root: ModelNode, expanded: ReadonlySet<ModelNode>): TreeRow[] {
  const rows: TreeRow[] = [];
  const stack: StackEntry[] = [{ node: root, depth: 0, posInSet: 1, setSize: 1 }];
  let entry: StackEntry | undefined;
  while ((entry = stack.pop()) !== undefined) {
    const { node, depth, posInSet, setSize } = entry;
    const expandable = node.children !== null && node.children.length > 0;
    const isExpanded = expandable && expanded.has(node);
    rows.push({ node, depth, expandable, expanded: isExpanded, posInSet, setSize });
    if (isExpanded && node.children !== null) {
      const count = node.children.length;
      for (let index = count - 1; index >= 0; index--) {
        stack.push({
          node: node.children[index],
          depth: depth + 1,
          posInSet: index + 1,
          setSize: count,
        });
      }
    }
  }
  return rows;
}

export interface VisibleTree {
  total: number;
  window: (start: number, end: number) => TreeRow[];
  rowAt: (index: number) => TreeRow | undefined;
  indexOf: (node: ModelNode) => number;
}

export function visibleTree(root: ModelNode, expanded: ReadonlySet<ModelNode>): VisibleTree {
  const counts = new Map<ModelNode, number>();
  const countOf = (node: ModelNode): number => {
    if (node.children === null || node.children.length === 0 || !expanded.has(node)) return 1;
    const cached = counts.get(node);
    if (cached !== undefined) return cached;
    let total = 1;
    for (const child of node.children) total += countOf(child);
    counts.set(node, total);
    return total;
  };
  const total = countOf(root);

  const window = (start: number, end: number): TreeRow[] => {
    const rows: TreeRow[] = [];
    const collect = (node: ModelNode, depth: number, pos: number, size: number, at: number) => {
      if (at >= end) return;
      const expandable = node.children !== null && node.children.length > 0;
      const isExpanded = expandable && expanded.has(node);
      if (at >= start) {
        rows.push({ node, depth, expandable, expanded: isExpanded, posInSet: pos, setSize: size });
      }
      if (!isExpanded || node.children === null) return;
      let childAt = at + 1;
      const count = node.children.length;
      for (let index = 0; index < count; index++) {
        if (childAt >= end) return;
        const child = node.children[index];
        const childCount = countOf(child);
        if (childAt + childCount > start) {
          collect(child, depth + 1, index + 1, count, childAt);
        }
        childAt += childCount;
      }
    };
    collect(root, 0, 1, 1, 0);
    return rows;
  };

  const rowAt = (index: number): TreeRow | undefined => window(index, index + 1)[0];

  const indexOf = (node: ModelNode): number => {
    let index = 0;
    let current = node;
    while (current.parent !== null) {
      const parent = current.parent;
      index += 1;
      if (parent.children !== null) {
        for (const sibling of parent.children) {
          if (sibling === current) break;
          index += countOf(sibling);
        }
      }
      current = parent;
    }
    return index;
  };

  return { total, window, rowAt, indexOf };
}

export function rowLabel(node: ModelNode): string {
  if (node.segment === null) return "$";
  return node.segment.kind === "key" ? node.segment.key : `[${node.segment.index}]`;
}

export function valuePreview(node: ModelNode): string {
  const value = node.value;
  if (Array.isArray(value)) return value.length === 0 ? "[]" : `[${value.length}]`;
  if (value !== null && typeof value === "object") {
    const size = Object.keys(value).length;
    return size === 0 ? "{}" : `{${size}}`;
  }
  if (typeof value === "string") {
    const truncated = value.length > 80 ? `${value.slice(0, 80)}\u2026` : value;
    return JSON.stringify(truncated);
  }
  return String(value);
}
