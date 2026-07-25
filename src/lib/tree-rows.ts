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
  const prefixes = new Map<ModelNode, Float64Array>();

  const isOpen = (node: ModelNode): boolean =>
    node.children !== null && node.children.length > 0 && expanded.has(node);

  const countOf = (node: ModelNode): number => {
    const cached = counts.get(node);
    if (cached !== undefined) return cached;
    if (!isOpen(node)) return 1;
    fill(node);
    return counts.get(node) ?? 1;
  };

  const prefixOf = (node: ModelNode): Float64Array => {
    const cached = prefixes.get(node);
    if (cached !== undefined) return cached;
    fill(node);
    return prefixes.get(node) ?? new Float64Array(1);
  };

  const childCount = (child: ModelNode): number => {
    if (!isOpen(child)) return 1;
    return counts.get(child) ?? -1;
  };

  const fill = (target: ModelNode): void => {
    const stack: ModelNode[] = [target];
    while (stack.length > 0) {
      const node = stack[stack.length - 1];
      if (counts.has(node) || !isOpen(node)) {
        stack.pop();
        continue;
      }
      const children = node.children ?? [];
      const prefix = new Float64Array(children.length + 1);
      let ready = true;
      for (let index = 0; index < children.length; index++) {
        const count = childCount(children[index]);
        if (count < 0) {
          stack.push(children[index]);
          ready = false;
          continue;
        }
        if (ready) prefix[index + 1] = prefix[index] + count;
      }
      if (!ready) continue;
      prefixes.set(node, prefix);
      counts.set(node, 1 + prefix[prefix.length - 1]);
      stack.pop();
    }
  };

  const positionOf = (node: ModelNode): number => {
    if (node.segment?.kind === "index") return node.segment.index;
    const siblings = node.parent?.children ?? [];
    for (let index = 0; index < siblings.length; index++) {
      if (siblings[index] === node) return index;
    }
    return 0;
  };

  const total = countOf(root);

  const firstChildAtOrAfter = (prefix: Float64Array, offset: number): number => {
    let low = 0;
    let high = prefix.length - 2;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (prefix[middle + 1] > offset) high = middle;
      else low = middle + 1;
    }
    return low;
  };

  interface WindowFrame {
    node: ModelNode;
    depth: number;
    at: number;
    prefix: Float64Array;
    next: number;
  }

  const window = (start: number, end: number): TreeRow[] => {
    const rows: TreeRow[] = [];
    const emit = (
      node: ModelNode,
      depth: number,
      pos: number,
      size: number,
      at: number,
    ): boolean => {
      const expandable = node.children !== null && node.children.length > 0;
      const isExpanded = expandable && expanded.has(node);
      if (at >= start) {
        rows.push({ node, depth, expandable, expanded: isExpanded, posInSet: pos, setSize: size });
      }
      return isExpanded;
    };
    if (end <= 0 || !emit(root, 0, 1, 1, 0)) return rows;
    const rootPrefix = prefixOf(root);
    const stack: WindowFrame[] = [
      {
        node: root,
        depth: 0,
        at: 0,
        prefix: rootPrefix,
        next: firstChildAtOrAfter(rootPrefix, start - 1),
      },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const count = frame.node.children?.length ?? 0;
      if (frame.next >= count) {
        stack.pop();
        continue;
      }
      const index = frame.next++;
      const childAt = frame.at + 1 + frame.prefix[index];
      if (childAt >= end) {
        stack.pop();
        continue;
      }
      const child = frame.node.children![index];
      const opened = emit(child, frame.depth + 1, index + 1, count, childAt);
      if (opened) {
        const prefix = prefixOf(child);
        const offset = Math.max(0, start - (childAt + 1));
        stack.push({
          node: child,
          depth: frame.depth + 1,
          at: childAt,
          prefix,
          next: firstChildAtOrAfter(prefix, offset),
        });
      }
    }
    return rows;
  };

  const rowAt = (index: number): TreeRow | undefined => window(index, index + 1)[0];

  const indexOf = (node: ModelNode): number => {
    let index = 0;
    let current = node;
    while (current.parent !== null) {
      const parent = current.parent;
      const prefix = prefixOf(parent);
      index += 1 + prefix[positionOf(current)];
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
