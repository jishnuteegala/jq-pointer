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
