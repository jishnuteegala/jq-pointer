import { generaliseClickPair } from "../src/lib/click-pair";
import { pathTo, type ModelNode, type PathStep } from "../src/lib/path-model";

export interface ClickPairResult {
  ancestor: ModelNode;
  steps: PathStep[];
  matches: ModelNode[];
}

export function runClickPair(a: ModelNode, b: ModelNode): ClickPairResult | null {
  const result = generaliseClickPair(a, b);
  if (result === null) return null;
  const ancestorPath = pathTo(result.ancestor);
  if (ancestorPath.kind !== "path") return null;
  return {
    ancestor: result.ancestor,
    steps: result.expression.steps.slice(ancestorPath.segments.length),
    matches: result.matches,
  };
}
