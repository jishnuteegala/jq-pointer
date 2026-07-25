import type { JqExpression, PathExpression } from "./jq-expression";
import {
  evaluateTrace,
  pathTo,
  type ModelNode,
  type PathSegment,
  type PathStep,
} from "./path-model";

export interface OutputEntry {
  expression: JqExpression;
  matches: ModelNode[];
  matchCount: number;
  elementCount: number;
  heterogeneous: boolean;
}

export interface Breadcrumb {
  ancestors: ModelNode[];
  activeIndex: number;
}

export interface Selection {
  outputs: OutputEntry[];
  breadcrumb: Breadcrumb | null;
  noCommonPattern: boolean;
}

function arrayAncestors(node: ModelNode): ModelNode[] {
  const result: ModelNode[] = [];
  let current: ModelNode | null = node.parent;
  while (current !== null) {
    if (Array.isArray(current.value)) result.push(current);
    current = current.parent;
  }
  return result;
}

function sharedArrayAncestors(nodes: ModelNode[]): ModelNode[] {
  if (nodes.length === 0) return [];
  let shared = arrayAncestors(nodes[0]);
  for (let index = 1; index < nodes.length; index++) {
    const set = new Set(arrayAncestors(nodes[index]));
    shared = shared.filter((ancestor) => set.has(ancestor));
  }
  return shared;
}

function relativeSegments(node: ModelNode, ancestorDepth: number): PathSegment[] | null {
  const result = pathTo(node);
  if (result.kind !== "path") return null;
  return result.segments.slice(ancestorDepth);
}

function mergeSegment(
  index: number,
  a: PathSegment,
  b: PathSegment,
): PathSegment | "iterate" | null {
  if (index === 0) {
    if (a.kind !== "index" || b.kind !== "index") return null;
    return "iterate";
  }
  if (a.kind === "index" && b.kind === "index") return a.index === b.index ? a : "iterate";
  if (a.kind === "key" && b.kind === "key" && a.key === b.key) return a;
  return null;
}

export function generaliseOverAncestor(
  ancestor: ModelNode,
  nodes: ModelNode[],
  forceIterate = false,
): OutputEntry | null {
  if (ancestor.children === null) return null;
  const ancestorPath = pathTo(ancestor);
  if (ancestorPath.kind !== "path") return null;
  const ancestorDepth = ancestorPath.segments.length;
  const relatives = nodes.map((node) => relativeSegments(node, ancestorDepth));
  if (relatives.some((relative) => relative === null || relative.length === 0)) return null;
  const segments = relatives as PathSegment[][];
  const length = segments[0].length;
  if (segments.some((relative) => relative.length !== length)) return null;
  const merged: (PathSegment | "iterate")[] = [];
  for (let index = 0; index < length; index++) {
    let acc: PathSegment | "iterate" = segments[0][index];
    for (let node = 1; node < segments.length; node++) {
      const previous: PathSegment = acc === "iterate" ? { kind: "index", index: -1 } : acc;
      const next = mergeSegment(index, previous, segments[node][index]);
      if (next === null) return null;
      acc = acc === "iterate" && next !== "iterate" ? "iterate" : next;
    }
    if (index === 0) {
      if (forceIterate) acc = "iterate";
      else if (acc !== "iterate") return null;
    }
    merged.push(acc);
  }
  const bare: PathStep[] = merged.map((step) =>
    step === "iterate" ? { kind: "iterate" } : { ...step },
  );
  return finaliseGeneralisation(ancestor, ancestorPath.segments, bare);
}

function isConstruction(nodes: ModelNode[]): boolean {
  if (nodes.length < 2) return false;
  const parents = nodes.map((node) => node.parent);
  if (parents.some((parent) => parent === null)) return false;
  if (new Set(parents).size !== 1) return false;
  const keys = nodes.map((node) => node.segment);
  if (keys.some((segment) => segment?.kind !== "key")) return false;
  const names = keys.map((segment) => (segment as { key: string }).key);
  return new Set(names).size === names.length;
}

function resolveOverAncestor(ancestor: ModelNode, nodes: ModelNode[]): OutputEntry | null {
  if (isConstruction(nodes)) return constructionOverAncestor(ancestor, nodes);
  return generaliseOverAncestor(ancestor, nodes, true);
}

export function resolveSelection(clicks: ModelNode[], ancestorIndex = 0): Selection {
  const empty: Selection = { outputs: [], breadcrumb: null, noCommonPattern: false };
  if (clicks.length === 0) return empty;
  if (clicks.length === 1) {
    const output = singlePathOutput(clicks[0]);
    return output === null
      ? empty
      : { outputs: [output], breadcrumb: null, noCommonPattern: false };
  }
  return resolveSelectionAt(clicks, ancestorIndex);
}

export function resolveSelectionAt(clicks: ModelNode[], ancestorIndex: number): Selection {
  const construction = isConstruction(clicks);
  const anchors = construction ? [clicks[0].parent as ModelNode] : clicks;
  const shared = sharedArrayAncestors(anchors);
  if (shared.length === 0) return separateOutputs(clicks);
  const activeIndex = Math.max(0, Math.min(shared.length - 1, ancestorIndex));
  const output = resolveOverAncestor(shared[activeIndex], clicks);
  if (output === null) return separateOutputs(clicks);
  return {
    outputs: [output],
    breadcrumb: shared.length > 1 ? { ancestors: shared, activeIndex } : null,
    noCommonPattern: false,
  };
}

function separateOutputs(clicks: ModelNode[]): Selection {
  const outputs: OutputEntry[] = [];
  for (const click of clicks) {
    const output = singlePathOutput(click);
    if (output === null) return { outputs: [], breadcrumb: null, noCommonPattern: true };
    outputs.push(output);
  }
  return { outputs, breadcrumb: null, noCommonPattern: true };
}

function singlePathOutput(node: ModelNode): OutputEntry | null {
  const result = pathTo(node);
  if (result.kind !== "path") return null;
  return {
    expression: { kind: "path", steps: result.segments },
    matches: [node],
    matchCount: 1,
    elementCount: 1,
    heterogeneous: false,
  };
}

function constructionOverAncestor(ancestor: ModelNode, nodes: ModelNode[]): OutputEntry | null {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.segment?.kind !== "key") return null;
    keys.push(node.segment.key);
  }
  if (new Set(keys).size !== keys.length) return null;
  const source = generaliseOverAncestor(
    ancestor,
    nodes.map((node) => node.parent as ModelNode),
    true,
  );
  if (source === null || source.expression.kind !== "path") return null;
  const construction: JqExpression = {
    kind: "construction",
    source: source.expression,
    keys,
  };
  const matches = source.matches.flatMap((element) =>
    keys.flatMap((key) => {
      const child = element.children?.find(
        (candidate) => candidate.segment?.kind === "key" && candidate.segment.key === key,
      );
      return child !== undefined && child.exists ? [child] : [];
    }),
  );
  return {
    expression: construction,
    matches,
    matchCount: source.matchCount,
    elementCount: source.elementCount,
    heterogeneous: source.heterogeneous,
  };
}

export function finaliseGeneralisation(
  ancestor: ModelNode,
  ancestorSegments: PathSegment[],
  bare: PathStep[],
): OutputEntry | null {
  if (ancestor.children === null) return null;
  const tail = bare.slice(1);
  const trace = evaluateTrace(ancestor.children, tail);
  const steps: PathStep[] = [
    { kind: "iterate" },
    ...tail.map((step, index) => (trace.optional[index] ? { ...step, optional: true } : step)),
  ];
  const matches = trace.matches.filter((node) => node.exists);
  const elementCount = ancestor.children.length;
  const expression: PathExpression = {
    kind: "path",
    steps: [...ancestorSegments, ...steps],
  };
  const relativeDepth = steps.length - 1;
  const presentElements = new Set<ModelNode>();
  for (const node of matches) {
    let element: ModelNode | null = node;
    for (let hop = 0; hop < relativeDepth && element !== null; hop++) element = element.parent;
    if (element !== null) presentElements.add(element);
  }
  return {
    expression,
    matches,
    matchCount: presentElements.size,
    elementCount,
    heterogeneous: presentElements.size < elementCount,
  };
}
