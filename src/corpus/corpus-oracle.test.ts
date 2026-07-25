import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { describe, expect, it } from "vitest";
import { evaluateExpression, printExpression, type JqExpression } from "../lib/jq-expression";
import type { JsonValue } from "../lib/json-value";
import { buildPathModel } from "../lib/path-model";
import { resolveSelection } from "../lib/selection";
import { firstClickPairScenarios, nodeAtSegments } from "./corpus";

const jq = process.env.JQ_BINARY ?? "./jq-1.7.1";
const canRunOracle = platform() !== "win32" && existsSync(jq);
const oracle = canRunOracle ? describe : describe.skip;

function runJq(document: unknown, expression: string): unknown[] {
  const output = execFileSync(jq, ["--compact-output", expression], {
    encoding: "utf8",
    input: JSON.stringify(document),
  });
  return output.trim() === ""
    ? []
    : output
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown);
}

function flattenStream(raw: unknown[], expression: JqExpression): unknown[] {
  if (expression.kind === "path") return raw;
  const keys = [...new Set(expression.keys)];
  return raw.flatMap((object) => keys.map((key) => (object as Record<string, unknown>)[key]));
}

interface ScenarioResult {
  id: string;
  pass: boolean;
  reason: string;
}

function runScenario(scenario: (typeof firstClickPairScenarios)[number]): ScenarioResult {
  const model = buildPathModel(scenario.document);
  const clicks = scenario.clicks.map((segments) => nodeAtSegments(model.root, segments));
  const clickedValues = clicks.map((node) => node.value);
  const selection = resolveSelection(clicks);
  if (selection.noCommonPattern || selection.outputs.length !== 1) {
    return { id: scenario.id, pass: false, reason: "no single generalised output" };
  }
  const output = selection.outputs[0];
  const printed = printExpression(output.expression);
  const preview = evaluateExpression(model.root, output.expression).map((node) => node.value);
  const jqStream = flattenStream(
    runJq(scenario.document, printed),
    output.expression,
  ) as JsonValue[];
  if (JSON.stringify(jqStream) !== JSON.stringify(preview)) {
    return {
      id: scenario.id,
      pass: false,
      reason: `jq ${printed} => ${JSON.stringify(jqStream)} != preview ${JSON.stringify(preview)}`,
    };
  }
  const previewJson = preview.map((value) => JSON.stringify(value));
  const missing = clickedValues.filter((value) => !previewJson.includes(JSON.stringify(value)));
  if (missing.length > 0) {
    return {
      id: scenario.id,
      pass: false,
      reason: `default ancestor dropped clicked values ${JSON.stringify(missing)}`,
    };
  }
  return { id: scenario.id, pass: true, reason: printed };
}

oracle("corpus first-click-pair gate", () => {
  it("passes at least 9 of 10 corpus documents through real jq", () => {
    const results = firstClickPairScenarios.map(runScenario);
    const passes = results.filter((result) => result.pass).length;
    const report = results
      .map((result) => `${result.pass ? "PASS" : "FAIL"} ${result.id}: ${result.reason}`)
      .join("\n");
    expect(passes, `first-click-pair results (${passes}/10):\n${report}`).toBeGreaterThanOrEqual(9);
  });

  it("round-trips every tool-generated expression through real jq for the non-null stream", () => {
    for (const scenario of firstClickPairScenarios) {
      const model = buildPathModel(scenario.document);
      const clicks = scenario.clicks.map((segments) => nodeAtSegments(model.root, segments));
      const selection = resolveSelection(clicks);
      if (selection.noCommonPattern || selection.outputs.length !== 1) continue;
      const output = selection.outputs[0];
      const printed = printExpression(output.expression);
      const jqStream = flattenStream(runJq(scenario.document, printed), output.expression);
      const nonNullJq = jqStream.filter((value) => value !== null);
      const previewValues = output.matches
        .map((node) => node.value)
        .filter((value) => value !== null);
      expect(nonNullJq, `${scenario.id}: ${printed}`).toEqual(previewValues);
    }
  });
});
