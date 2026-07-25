import type { PathExpression } from "./jq-expression";
import { commonArrayAncestor, type ModelNode } from "./path-model";
import { generaliseOverAncestor } from "./selection";

export interface ClickPairResult {
  ancestor: ModelNode;
  expression: PathExpression;
  matches: ModelNode[];
  matchCount: number;
  elementCount: number;
  heterogeneous: boolean;
}

export function generaliseClickPair(a: ModelNode, b: ModelNode): ClickPairResult | null {
  if (a === b) return null;
  const ancestor = commonArrayAncestor(a, b);
  if (ancestor === null) return null;
  const output = generaliseOverAncestor(ancestor, [a, b]);
  if (output === null || output.expression.kind !== "path") return null;
  return {
    ancestor,
    expression: output.expression,
    matches: output.matches,
    matchCount: output.matchCount,
    elementCount: output.elementCount,
    heterogeneous: output.heterogeneous,
  };
}
