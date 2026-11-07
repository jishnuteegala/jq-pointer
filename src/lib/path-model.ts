import type { JsonValue } from "./json-value";

export type PathSegment = { kind: "key"; key: string } | { kind: "index"; index: number };

export type PathStep =
  | (PathSegment & { optional?: boolean })
  | { kind: "iterate"; optional?: boolean };

export interface ModelNode {
  value: JsonValue;
  parent: ModelNode | null;
  segment: PathSegment | null;
  children: ModelNode[] | null;
  jqAddressable: boolean;
  exists: boolean;
}

export interface PathModel {
  root: ModelNode;
  nodeCount: number;
}

export type PathResult =
  | { kind: "path"; segments: PathSegment[] }
  | { kind: "unsupported"; reason: "lone-surrogate-key" | "synthetic-result" };

export function buildPathModel(value: JsonValue): PathModel {
  let nodeCount = 0;
  // Children share one segment object per key and per index: the click path reads every child's
  // segment, and a shared one stays in cache. Shared segments must never be mutated.
  const keySegments = new Map<string, PathSegment>();
  const indexSegments: PathSegment[] = [];
  const root: ModelNode = {
    value,
    parent: null,
    segment: null,
    children: null,
    jqAddressable: true,
    exists: true,
  };
  const stack: ModelNode[] = [root];
  let node: ModelNode | undefined;
  while ((node = stack.pop()) !== undefined) {
    nodeCount++;
    const v = node.value;
    // Children arrays are sized up front: push-grown arrays keep spare capacity (about a fifth of
    // the model's heap), and Array.from({ length }) builds the model about four times slower.
    if (Array.isArray(v)) {
      // oxlint-disable-next-line unicorn/no-new-array
      const children: ModelNode[] = new Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const child: ModelNode = {
          value: v[i],
          parent: node,
          segment: (indexSegments[i] ??= { kind: "index", index: i }),
          children: null,
          jqAddressable: node.jqAddressable,
          exists: true,
        };
        children[i] = child;
        stack.push(child);
      }
      node.children = children;
    } else if (v !== null && typeof v === "object") {
      const keys = Object.keys(v);
      // oxlint-disable-next-line unicorn/no-new-array
      const children: ModelNode[] = new Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        let segment = keySegments.get(key);
        if (segment === undefined) {
          segment = { kind: "key", key };
          keySegments.set(key, segment);
        }
        const child: ModelNode = {
          value: v[key],
          parent: node,
          segment,
          children: null,
          jqAddressable: node.jqAddressable && !hasLoneSurrogate(key),
          exists: true,
        };
        children[i] = child;
        stack.push(child);
      }
      node.children = children;
    }
  }
  return { root, nodeCount };
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
        index++;
      } else return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

/** Returns an explicit unsupported result when jq cannot represent the node's key path. */
export function pathTo(node: ModelNode): PathResult {
  if (!node.exists) return { kind: "unsupported", reason: "synthetic-result" };
  if (!node.jqAddressable) return { kind: "unsupported", reason: "lone-surrogate-key" };
  const segments: PathSegment[] = [];
  let current: ModelNode | null = node;
  while (current !== null && current.segment !== null) {
    segments.push(current.segment);
    current = current.parent;
  }
  segments.reverse();
  return { kind: "path", segments };
}

// Sibling objects in an array usually share key order, so the previous match position is
// tried first; keys are unique within an object, so a hit there is the only match.
let lastKeyIndex = 0;

function childByKey(node: ModelNode, key: string): ModelNode | undefined {
  const children = node.children;
  if (children === null) return undefined;
  const guess = children[lastKeyIndex]?.segment;
  if (guess?.kind === "key" && guess.key === key) return children[lastKeyIndex];
  for (let index = 0; index < children.length; index++) {
    const segment = children[index].segment;
    if (segment?.kind === "key" && segment.key === key) {
      lastKeyIndex = index;
      return children[index];
    }
  }
  return undefined;
}

export function evaluateSteps(root: ModelNode, steps: PathStep[]): ModelNode[] {
  return evaluateStepsFrom([root], steps);
}

function applyStep(node: ModelNode, step: PathStep, out: ModelNode[]): void {
  if (step.kind === "iterate") {
    if (node.children !== null) {
      for (const child of node.children) out.push(child);
    } else if (!step.optional) throw new TypeError("cannot iterate over a scalar");
  } else if (step.kind === "index") {
    if (Array.isArray(node.value) && node.children !== null) {
      const index = step.index < 0 ? node.children.length + step.index : step.index;
      const child = node.children[index];
      if (child !== undefined) out.push(child);
      else out.push(nullNode(node));
    } else if (node.value === null) {
      out.push(nullNode(node));
    } else if (!step.optional) throw new TypeError("cannot index a non-array");
  } else {
    if (
      node.value !== null &&
      typeof node.value === "object" &&
      !Array.isArray(node.value) &&
      node.children !== null
    ) {
      const child = childByKey(node, step.key);
      if (child !== undefined) out.push(child);
      else out.push(nullNode(node));
    } else if (node.value === null) {
      out.push(nullNode(node));
    } else if (node.value !== null && !step.optional) {
      throw new TypeError("cannot index a scalar with a key");
    }
  }
}

function evaluateStepsFrom(roots: ModelNode[], steps: PathStep[]): ModelNode[] {
  let current: ModelNode[] = roots;
  for (const step of steps) {
    const next: ModelNode[] = [];
    for (const node of current) applyStep(node, step, next);
    current = next;
  }
  return current;
}

// Each block of roots runs through every step before the next block starts, so the nodes one
// step yields are still in cache when the next step reads them. Steps map each node to its
// results in order, so concatenating the blocks gives the same matches as one pass.
const TRACE_BLOCK = 512;

export function evaluateTrace(
  roots: ModelNode[],
  steps: PathStep[],
): { optional: boolean[]; matches: ModelNode[] } {
  const optional: boolean[] = Array.from({ length: steps.length }, () => false);
  const safeSteps: PathStep[] = steps.map((step) => ({ ...step, optional: true }));
  const matches: ModelNode[] = [];
  for (let start = 0; start < roots.length; start += TRACE_BLOCK) {
    let current = roots.slice(start, start + TRACE_BLOCK);
    for (let s = 0; s < safeSteps.length; s++) {
      const next: ModelNode[] = [];
      for (const node of current) {
        const before = next.length;
        applyStep(node, safeSteps[s], next);
        // The non-optional step would throw or yield jq's synthetic null exactly when the
        // optional step yields nothing or a non-existent node.
        if (next.length === before || !next[next.length - 1].exists) optional[s] = true;
      }
      current = next;
    }
    for (const node of current) matches.push(node);
  }
  return { optional, matches };
}

/** Returns only document nodes that can be highlighted, excluding jq's synthetic null results. */
export function matchingNodes(root: ModelNode, steps: PathStep[]): ModelNode[] {
  return evaluateSteps(root, steps).filter((node) => node.exists);
}

function nullNode(parent: ModelNode): ModelNode {
  return {
    value: null,
    parent,
    segment: null,
    children: null,
    jqAddressable: parent.jqAddressable,
    exists: false,
  };
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
