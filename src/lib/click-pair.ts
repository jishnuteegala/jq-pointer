import type { PathExpression } from "./jq-expression";
import {
  commonArrayAncestor,
  evaluateSteps,
  matchingNodes,
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
): { steps: PathStep[]; matches: ModelNode[] } {
  const placed: PathStep[] = [];
  let stream: ModelNode[] = [ancestor];
  for (const step of steps) {
    const optional = stream.some((node) => stepThrows(node, step));
    const resolved: PathStep = optional ? { ...step, optional: true } : { ...step };
    placed.push(resolved);
    stream = stream.flatMap((node) => evaluateSteps(node, [resolved]));
  }
  return { steps: placed, matches: stream.filter((node) => node.exists) };
}

function countPresent(elements: ModelNode[], leaf: PathStep[]): number {
  if (leaf.length === 0) return elements.length;
  const optionalLeaf = leaf.map((step) => ({ ...step, optional: true }));
  let count = 0;
  for (const element of elements) {
    if (matchingNodes(element, optionalLeaf).length > 0) count++;
  }
  return count;
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
  const { steps, matches } = placeOptionals(ancestor, bare);
  const elementCount = ancestor.children.length;
  const matchCount = countPresent(ancestor.children, steps.slice(1));
  const expression: PathExpression = {
    kind: "path",
    steps: [...ancestorPath.segments, ...steps],
  };
  return {
    ancestor,
    expression,
    matches,
    matchCount,
    elementCount,
    heterogeneous: matchCount < elementCount,
  };
}
