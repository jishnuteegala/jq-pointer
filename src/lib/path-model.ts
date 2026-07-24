import type { JsonValue } from "./json-value";

export type PathSegment = { kind: "key"; key: string } | { kind: "index"; index: number };

export type PathStep = PathSegment | { kind: "iterate" };

export interface ModelNode {
  value: JsonValue;
  parent: ModelNode | null;
  segment: PathSegment | null;
  children: ModelNode[] | null;
}

export interface PathModel {
  root: ModelNode;
  nodeCount: number;
}

export function buildPathModel(value: JsonValue): PathModel {
  let nodeCount = 0;
  const root: ModelNode = { value, parent: null, segment: null, children: null };
  const stack: ModelNode[] = [root];
  let node: ModelNode | undefined;
  while ((node = stack.pop()) !== undefined) {
    nodeCount++;
    const v = node.value;
    if (Array.isArray(v)) {
      const children: ModelNode[] = [];
      for (let i = 0; i < v.length; i++) {
        const child: ModelNode = {
          value: v[i],
          parent: node,
          segment: { kind: "index", index: i },
          children: null,
        };
        children.push(child);
        stack.push(child);
      }
      node.children = children;
    } else if (v !== null && typeof v === "object") {
      const keys = Object.keys(v);
      const children: ModelNode[] = [];
      for (const key of keys) {
        const child: ModelNode = {
          value: v[key],
          parent: node,
          segment: { kind: "key", key },
          children: null,
        };
        children.push(child);
        stack.push(child);
      }
      node.children = children;
    }
  }
  return { root, nodeCount };
}

export function pathTo(node: ModelNode): PathSegment[] {
  const segments: PathSegment[] = [];
  let current: ModelNode | null = node;
  while (current !== null && current.segment !== null) {
    segments.push(current.segment);
    current = current.parent;
  }
  segments.reverse();
  return segments;
}

export function evaluateSteps(root: ModelNode, steps: PathStep[]): ModelNode[] {
  let current: ModelNode[] = [root];
  for (const step of steps) {
    const next: ModelNode[] = [];
    for (const node of current) {
      if (step.kind === "iterate") {
        if (node.children !== null) {
          for (const child of node.children) next.push(child);
        }
      } else if (step.kind === "index") {
        if (Array.isArray(node.value) && node.children !== null) {
          const child = node.children[step.index];
          if (child !== undefined) next.push(child);
        }
      } else {
        if (
          node.value !== null &&
          typeof node.value === "object" &&
          !Array.isArray(node.value) &&
          node.children !== null
        ) {
          for (const child of node.children) {
            if (child.segment?.kind === "key" && child.segment.key === step.key) {
              next.push(child);
              break;
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

export function commonArrayAncestor(a: ModelNode, b: ModelNode): ModelNode | null {
  const ancestorsOfA = new Set<ModelNode>();
  let current: ModelNode | null = a;
  while (current !== null) {
    ancestorsOfA.add(current);
    current = current.parent;
  }
  current = b;
  while (current !== null) {
    if (ancestorsOfA.has(current)) break;
    current = current.parent;
  }
  while (current !== null) {
    if (Array.isArray(current.value)) return current;
    current = current.parent;
  }
  return null;
}
