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

function placeOptionals(
  ancestor: ModelNode,
  steps: PathStep[],
): { steps: PathStep[]; matches: ModelNode[]; matchCount: number } {
  const roots = ancestor.children ?? [];
  const optionalAt: boolean[] = steps.map(() => false);
  const matches: ModelNode[] = [];
  const visit = (node: ModelNode, index: number): boolean => {
    if (index === steps.length) {
      if (!node.exists) return false;
      matches.push(node);
      return true;
    }
    const step = steps[index];
    if (stepThrows(node, step)) optionalAt[index] = true;
    if (step.kind === "iterate") {
      if (node.children === null) return false;
      let matched = false;
      for (const child of node.children) if (visit(child, index + 1)) matched = true;
      return matched;
    }
    if (step.kind === "index") {
      if (Array.isArray(node.value) && node.children !== null) {
        const childIndex = step.index < 0 ? node.children.length + step.index : step.index;
        return visit(node.children[childIndex] ?? nullNode(node), index + 1);
      }
      return node.value === null ? visit(nullNode(node), index + 1) : false;
    }
    if (node.value !== null && typeof node.value === "object" && node.children !== null) {
      for (const child of node.children) {
        if (child.segment?.kind === "key" && child.segment.key === step.key) {
          return visit(child, index + 1);
        }
      }
      return visit(nullNode(node), index + 1);
    }
    return node.value === null ? visit(nullNode(node), index + 1) : false;
  };
  let matchCount = 0;
  for (const root of roots) if (visit(root, 1)) matchCount++;
  const placed = steps.map((step, index) =>
    optionalAt[index] ? { ...step, optional: true } : { ...step },
  );
  return { steps: placed, matches, matchCount };
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
