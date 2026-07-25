import type { PathExpression } from "./jq-expression";
import {
  commonArrayAncestor,
  nullNode,
  pathTo,
  type ModelNode,
  type PathSegment,
  type PathStep,
} from "./path-model";

export interface ClickPairResult {
  ancestor: ModelNode;
  expression: PathExpression;
  matches: ModelNode[];
  matchCount: number;
  elementCount: number;
  heterogeneous: boolean;
}

function relativeSegments(node: ModelNode, ancestorDepth: number): PathSegment[] | null {
  const result = pathTo(node);
  if (result.kind !== "path") return null;
  return result.segments.slice(ancestorDepth);
}

function generaliseSteps(a: PathSegment[], b: PathSegment[]): PathStep[] | null {
  if (a.length !== b.length || a.length === 0) return null;
  const steps: PathStep[] = [];
  for (let index = 0; index < a.length; index++) {
    const segA = a[index];
    const segB = b[index];
    if (index === 0) {
      if (segA.kind !== "index" || segB.kind !== "index" || segA.index === segB.index) return null;
      steps.push({ kind: "iterate" });
    } else if (segA.kind === "index" && segB.kind === "index") {
      steps.push(segA.index === segB.index ? { ...segA } : { kind: "iterate" });
    } else if (segA.kind === "key" && segB.kind === "key" && segA.key === segB.key) {
      steps.push({ ...segA });
    } else {
      return null;
    }
  }
  return steps;
}

function stepThrows(node: ModelNode, step: PathStep): boolean {
  if (step.kind === "iterate") return node.children === null;
  if (node.value === null) return false;
  if (step.kind === "index") return !Array.isArray(node.value);
  return typeof node.value !== "object" || Array.isArray(node.value);
}

function applyStep(node: ModelNode, step: PathStep, out: ModelNode[]): void {
  if (step.kind === "iterate") {
    if (node.children !== null) for (const child of node.children) out.push(child);
  } else if (step.kind === "index") {
    if (Array.isArray(node.value) && node.children !== null) {
      const index = step.index < 0 ? node.children.length + step.index : step.index;
      out.push(node.children[index] ?? nullNode(node));
    } else if (node.value === null) {
      out.push(nullNode(node));
    }
  } else if (node.value !== null && typeof node.value === "object" && node.children !== null) {
    for (const child of node.children) {
      if (child.segment?.kind === "key" && child.segment.key === step.key) {
        out.push(child);
        return;
      }
    }
    out.push(nullNode(node));
  } else if (node.value === null) {
    out.push(nullNode(node));
  }
}

function placeOptionals(
  ancestor: ModelNode,
  steps: PathStep[],
): { steps: PathStep[]; matches: ModelNode[]; matchCount: number } {
  const placed: PathStep[] = [{ ...steps[0] }];
  const roots = ancestor.children ?? [];
  let nodes = roots.slice();
  let origins: number[] = roots.map((_, origin) => origin);
  for (let index = 1; index < steps.length; index++) {
    const step = steps[index];
    let optional = false;
    for (const node of nodes)
      if (stepThrows(node, step)) {
        optional = true;
        break;
      }
    const resolved: PathStep = optional ? { ...step, optional: true } : { ...step };
    placed.push(resolved);
    const nextNodes: ModelNode[] = [];
    const nextOrigins: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const before = nextNodes.length;
      applyStep(nodes[i], resolved, nextNodes);
      for (let j = before; j < nextNodes.length; j++) nextOrigins.push(origins[i]);
    }
    nodes = nextNodes;
    origins = nextOrigins;
  }
  const presentOrigins = new Set<number>();
  const matches: ModelNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].exists) continue;
    matches.push(nodes[i]);
    presentOrigins.add(origins[i]);
  }
  return { steps: placed, matches, matchCount: presentOrigins.size };
}

export function generaliseClickPair(a: ModelNode, b: ModelNode): ClickPairResult | null {
  const ancestor = commonArrayAncestor(a, b);
  if (ancestor === null || ancestor.children === null) return null;
  const ancestorPath = pathTo(ancestor);
  if (ancestorPath.kind !== "path") return null;
  const ancestorDepth = ancestorPath.segments.length;
  const relativeA = relativeSegments(a, ancestorDepth);
  const relativeB = relativeSegments(b, ancestorDepth);
  if (relativeA === null || relativeB === null) return null;
  const bare = generaliseSteps(relativeA, relativeB);
  if (bare === null) return null;
  const { steps, matches, matchCount } = placeOptionals(ancestor, bare);
  const expression: PathExpression = {
    kind: "path",
    steps: [...ancestorPath.segments, ...steps],
  };
  return {
    ancestor,
    expression,
    matches,
    matchCount,
    elementCount: ancestor.children.length,
    heterogeneous: matchCount < ancestor.children.length,
  };
}
