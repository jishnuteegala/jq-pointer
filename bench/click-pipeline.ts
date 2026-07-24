import {
  commonArrayAncestor,
  evaluateSteps,
  pathTo,
  type ModelNode,
  type PathStep,
} from "../src/lib/path-model";

export interface ClickPairResult {
  ancestor: ModelNode;
  steps: PathStep[];
  matches: ModelNode[];
}

export function runClickPair(a: ModelNode, b: ModelNode): ClickPairResult | null {
  const ancestor = commonArrayAncestor(a, b);
  if (ancestor === null) return null;
  const pathA = pathTo(a);
  const pathB = pathTo(b);
  const ancestorPath = pathTo(ancestor);
  if (pathA === null || pathB === null || ancestorPath === null) return null;
  const ancestorDepth = ancestorPath.length;
  const relativeA = pathA.slice(ancestorDepth);
  const relativeB = pathB.slice(ancestorDepth);
  if (relativeA.length !== relativeB.length) return null;
  const steps: PathStep[] = [];
  for (let i = 0; i < relativeA.length; i++) {
    const segA = relativeA[i];
    const segB = relativeB[i];
    if (segA.kind === "index" && segB.kind === "index") {
      if (i === 0) {
        if (segA.index === segB.index) return null;
        steps.push({ kind: "iterate" });
      } else if (segA.index === segB.index) {
        steps.push(segA);
      } else {
        return null;
      }
    } else if (segA.kind === "key" && segB.kind === "key" && segA.key === segB.key) {
      steps.push(segA);
    } else {
      return null;
    }
  }
  const matches = evaluateSteps(ancestor, steps);
  return { ancestor, steps, matches };
}
