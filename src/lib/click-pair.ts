import type { PathExpression } from "./jq-expression";
import {
  commonArrayAncestor,
  evaluateSteps,
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

function nodeUnsafe(node: ModelNode, step: PathStep): boolean {
  const value = node.value;
  if (step.kind === "iterate") return node.children === null;
  if (step.kind === "index") {
    if (!Array.isArray(value)) return true;
    const length = node.children?.length ?? 0;
    const at = step.index < 0 ? length + step.index : step.index;
    return at < 0 || at >= length;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return true;
  return (
    node.children?.some((c) => c.segment?.kind === "key" && c.segment.key === step.key) !== true
  );
}

function placeOptionals(
  ancestor: ModelNode,
  bare: PathStep[],
): { steps: PathStep[]; matches: ModelNode[] } {
  const placed: PathStep[] = [];
  let frontier: ModelNode[] = ancestor.children ?? [];
  for (let index = 1; index < bare.length; index++) {
    const step = bare[index];
    let optional = false;
    for (const node of frontier) {
      if (nodeUnsafe(node, step)) {
        optional = true;
        break;
      }
    }
    const resolved: PathStep = optional ? { ...step, optional: true } : { ...step };
    placed.push(resolved);
    frontier = evaluateSteps({ ...ancestor, segment: null, children: frontier }, [
      { kind: "iterate" },
      resolved,
    ]);
  }
  return {
    steps: [{ kind: "iterate" }, ...placed],
    matches: frontier.filter((node) => node.exists),
  };
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
