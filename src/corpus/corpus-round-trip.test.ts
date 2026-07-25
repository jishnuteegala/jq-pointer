import { describe, expect, it } from "vitest";
import { evaluateExpression, printExpression } from "../lib/jq-expression";
import { buildPathModel } from "../lib/path-model";
import { reverseHighlight } from "../lib/reverse-highlight";
import { generaliseOverAncestor, resolveSelection } from "../lib/selection";
import { extraKeyRoundTripScenarios, firstClickPairScenarios, nodeAtSegments } from "./corpus";

describe("corpus reverse-highlight round-trip", () => {
  it("round-trips 100% of tool-generated expressions with semantic equality", () => {
    for (const scenario of [...firstClickPairScenarios, ...extraKeyRoundTripScenarios]) {
      const model = buildPathModel(scenario.document);
      const clicks = scenario.clicks.map((segments) => nodeAtSegments(model.root, segments));
      const selection = resolveSelection(clicks);
      expect(selection.noCommonPattern, scenario.id).toBe(false);
      expect(selection.outputs.length, scenario.id).toBe(1);
      const output = selection.outputs[0];
      const printed = printExpression(output.expression);
      expect(printed, scenario.id).toBe(scenario.expected);
      const highlight = reverseHighlight(model.root, printed);
      expect(highlight.kind, `${scenario.id}: ${printed}`).toBe("match");
      if (highlight.kind !== "match") continue;
      expect(new Set(highlight.nodes), `${scenario.id}: ${printed}`).toEqual(
        new Set(output.matches),
      );
    }
  });

  it("defaults to the innermost ancestor; the wrong outer ancestor changes the value stream", () => {
    const document = {
      groups: [{ rows: [{ v: 1 }, { v: 2 }] }, { rows: [{ v: 1 }, { v: 2 }] }],
    };
    const model = buildPathModel(document);
    const rowsOf = (group: number, row: number) =>
      nodeAtSegments(model.root, [
        { kind: "key", key: "groups" },
        { kind: "index", index: group },
        { kind: "key", key: "rows" },
        { kind: "index", index: row },
        { kind: "key", key: "v" },
      ]);
    const first = rowsOf(0, 0);
    const second = rowsOf(0, 1);
    const selection = resolveSelection([first, second]);
    const output = selection.outputs[0];
    expect(printExpression(output.expression)).toBe(".groups[0].rows[].v");
    const defaultValues = evaluateExpression(model.root, output.expression).map((n) => n.value);
    expect(defaultValues).toEqual([1, 2]);

    const outerAncestor = model.root.children?.[0] as ReturnType<typeof nodeAtSegments>;
    const wrong = generaliseOverAncestor(outerAncestor, [first, second], true);
    expect(wrong).not.toBeNull();
    if (wrong !== null) {
      const wrongValues = evaluateExpression(model.root, wrong.expression).map((n) => n.value);
      expect(wrongValues).not.toEqual(defaultValues);
    }
  });
});
