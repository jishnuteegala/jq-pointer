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
    if (Array.isArray(v)) {
      const children: ModelNode[] = [];
      for (let i = 0; i < v.length; i++) {
        const child: ModelNode = {
          value: v[i],
          parent: node,
          segment: { kind: "index", index: i },
          children: null,
          jqAddressable: node.jqAddressable,
          exists: true,
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
          jqAddressable: node.jqAddressable && !hasLoneSurrogate(key),
          exists: true,
        };
        children.push(child);
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

function childByKey(node: ModelNode, key: string): ModelNode | undefined {
  if (node.children === null) return undefined;
  for (const child of node.children) {
    if (child.segment?.kind === "key" && child.segment.key === key) return child;
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

function stepUnsafe(node: ModelNode, step: PathStep): boolean {
  if (step.kind === "iterate") return node.children === null || node.children.length === 0;
  if (step.kind === "index") {
    if (!Array.isArray(node.value) || node.children === null) return true;
    const at = step.index < 0 ? node.children.length + step.index : step.index;
    return at < 0 || at >= node.children.length;
  }
  if (node.value === null || typeof node.value !== "object" || Array.isArray(node.value))
    return true;
  return childByKey(node, step.key) === undefined;
}

export function evaluateTrace(
  roots: ModelNode[],
  steps: PathStep[],
): { optional: boolean[]; matches: ModelNode[] } {
  const optional: boolean[] = Array.from({ length: steps.length }, () => false);
  let current: ModelNode[] = roots;
  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    const safeStep: PathStep = { ...step, optional: true };
    const next: ModelNode[] = [];
    let anyUnsafe = false;
    for (const node of current) {
      if (!anyUnsafe && stepUnsafe(node, step)) anyUnsafe = true;
      applyStep(node, safeStep, next);
    }
    optional[s] = anyUnsafe;
    current = next;
  }
  return { optional, matches: current };
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
