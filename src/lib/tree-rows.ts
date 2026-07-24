import type { ModelNode } from "./path-model";

export interface TreeRow {
  node: ModelNode;
  depth: number;
}

export function visibleTreeRows(root: ModelNode, expanded: ReadonlySet<ModelNode>): TreeRow[] {
  const rows: TreeRow[] = [];
  const stack: TreeRow[] = [{ node: root, depth: 0 }];
  let row: TreeRow | undefined;
  while ((row = stack.pop()) !== undefined) {
    rows.push(row);
    if (row.node.children !== null && expanded.has(row.node)) {
      for (let index = row.node.children.length - 1; index >= 0; index--) {
        stack.push({ node: row.node.children[index], depth: row.depth + 1 });
      }
    }
  }
  return rows;
}

export function valuePreview(node: ModelNode): string {
  if (Array.isArray(node.value)) return `[${node.value.length}]`;
  if (node.value !== null && typeof node.value === "object") return `{${Object.keys(node.value).length}}`;
  return JSON.stringify(node.value);
}

export function nodeLabel(node: ModelNode): string {
  if (node.segment === null) return "root";
  return node.segment.kind === "key" ? node.segment.key : `[${node.segment.index}]`;
}
