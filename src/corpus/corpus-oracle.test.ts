import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  evaluateJqExpression,
  printExpression,
  type JqExpression,
} from "../lib/jq-expression";
import type { JsonValue } from "../lib/json-value";
import { buildPathModel } from "../lib/path-model";
import { resolveSelection } from "../lib/selection";
import { extraKeyRoundTripScenarios, firstClickPairScenarios, nodeAtSegments } from "./corpus";

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
  const selection = resolveSelection(clicks);
  if (selection.noCommonPattern || selection.outputs.length !== 1) {
    return { id: scenario.id, pass: false, reason: "no single generalised output" };
  }
  const output = selection.outputs[0];
  const printed = printExpression(output.expression);
  if (printed !== scenario.expected) {
    return {
      id: scenario.id,
      pass: false,
      reason: `default ancestor emitted ${printed} != expected ${scenario.expected}`,
    };
  }
  const matches = evaluateExpression(model.root, output.expression);
  const preview = matches.map((node) => node.value);
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
  const matched = new Set(matches);
  const missing = clicks.filter((node) => !matched.has(node));
  if (missing.length > 0) {
    return {
      id: scenario.id,
      pass: false,
      reason: `default ancestor missed ${missing.length} clicked node(s)`,
    };
  }
  return { id: scenario.id, pass: true, reason: printed };
}

const allowedMiss = "08-heterogeneous-array";

oracle("corpus first-click-pair gate", () => {
  it("passes at least 9 of 10 corpus documents through real jq", () => {
    const results = firstClickPairScenarios.map(runScenario);
    const passes = results.filter((result) => result.pass).length;
    const failing = results.filter((result) => !result.pass).map((result) => result.id);
    const report = results
      .map((result) => `${result.pass ? "PASS" : "FAIL"} ${result.id}: ${result.reason}`)
      .join("\n");
    expect(passes, `first-click-pair results (${passes}/10):\n${report}`).toBeGreaterThanOrEqual(9);
    const unexpected = failing.filter((id) => id !== allowedMiss);
    expect(unexpected, `only ${allowedMiss} may miss; unexpected failures:\n${report}`).toEqual([]);
  });

  it("matches real jq exactly while preserving document nulls and marking synthetic missing values", () => {
    const scenarios = [...firstClickPairScenarios, ...extraKeyRoundTripScenarios];
    for (const scenario of scenarios) {
      const model = buildPathModel(scenario.document);
      const clicks = scenario.clicks.map((segments) => nodeAtSegments(model.root, segments));
      const selection = resolveSelection(clicks);
      for (const output of selection.outputs) {
        const printed = printExpression(output.expression);
        const jqStream = flattenStream(runJq(scenario.document, printed), output.expression);
        const evaluated = evaluateJqExpression(model.root, output.expression);
        expect(jqStream, `${scenario.id}: ${printed}`).toEqual(evaluated.map((node) => node.value));
        expect(evaluateExpression(model.root, output.expression)).toEqual(
          evaluated.filter((node) => node.exists),
        );
      }
    }
  });
});
