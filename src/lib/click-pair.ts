import type { PathExpression } from "./jq-expression";
import {
  commonArrayAncestor,
  evaluateTrace,
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
    steps: [...ancestorPath.segments, ...steps],
  };
  const relativeDepth = steps.length - 1;
  const presentElements = new Set<ModelNode>();
  for (const node of matches) {
    let element: ModelNode | null = node;
    for (let hop = 0; hop < relativeDepth && element !== null; hop++) element = element.parent;
    if (element !== null) presentElements.add(element);
  }
  return {
    ancestor,
    expression,
    matches,
    matchCount: presentElements.size,
    elementCount,
    heterogeneous: presentElements.size < elementCount,
  };
}
