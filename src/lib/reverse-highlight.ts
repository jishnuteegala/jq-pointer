import { evaluateExpression, parseExpression } from "./jq-expression";
import type { ModelNode } from "./path-model";

export type ReverseHighlight =
  | { kind: "empty" }
  | { kind: "unsupported" }
  | { kind: "runtime-error" }
  | { kind: "match"; nodes: ModelNode[] };

export function reverseHighlight(root: ModelNode, input: string): ReverseHighlight {
  const trimmed = input.trim();
  if (trimmed === "") return { kind: "empty" };
  const expression = parseExpression(trimmed);
  if (expression === null) return { kind: "unsupported" };
  try {
    return { kind: "match", nodes: evaluateExpression(root, expression) };
  } catch {
    return { kind: "runtime-error" };
  }
}
