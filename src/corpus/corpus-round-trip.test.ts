import { describe, expect, it } from "vitest";
import { printExpression } from "../lib/jq-expression";
import { buildPathModel } from "../lib/path-model";
import { reverseHighlight } from "../lib/reverse-highlight";
import { resolveSelection } from "../lib/selection";
import { firstClickPairScenarios, nodeAtSegments } from "./corpus";

describe("corpus reverse-highlight round-trip", () => {
  it("round-trips 100% of tool-generated expressions with semantic equality", () => {
    for (const scenario of firstClickPairScenarios) {
      const model = buildPathModel(scenario.document);
      const clicks = scenario.clicks.map((segments) => nodeAtSegments(model.root, segments));
      const selection = resolveSelection(clicks);
      expect(selection.noCommonPattern, scenario.id).toBe(false);
      expect(selection.outputs.length, scenario.id).toBe(1);
      const output = selection.outputs[0];
      const printed = printExpression(output.expression);
      const highlight = reverseHighlight(model.root, printed);
      expect(highlight.kind, `${scenario.id}: ${printed}`).toBe("match");
      if (highlight.kind !== "match") continue;
      expect(new Set(highlight.nodes), `${scenario.id}: ${printed}`).toEqual(
        new Set(output.matches),
      );
    }
  });
});
