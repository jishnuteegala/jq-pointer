import { describe, expect, it } from "vitest";
import { generateFixture } from "./fixture";
import { buildPathModel, pathTo, type ModelNode } from "../src/lib/path-model";
import { printPath } from "../src/lib/jq-expression";
import { flattenVisible } from "../src/lib/tree-rows";
import type { JsonValue } from "../src/lib/json-value";

const TARGET_BYTES = 10 * 1024 * 1024;
const CLICK_BUDGET_MS = 100;
const CLICK_SAMPLES = 50;

function percentile(values: number[], p: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

describe("tree view pipeline on a ~10MB document", () => {
  const { json, itemCount } = generateFixture(TARGET_BYTES);
  const parsed = JSON.parse(json) as JsonValue;
  const model = buildPathModel(parsed);

  it(`flattens visible rows with the items array expanded under ${CLICK_BUDGET_MS}ms`, () => {
    const items = model.root.children?.find(
      (child) => child.segment?.kind === "key" && child.segment.key === "items",
    ) as ModelNode;
    const expanded = new Set([model.root, items]);
    const timings: number[] = [];
    let rowCount = 0;
    for (let i = 0; i < CLICK_SAMPLES; i++) {
      const start = performance.now();
      rowCount = flattenVisible(model.root, expanded).length;
      timings.push(performance.now() - start);
    }
    const coldMs = timings[0];
    const p95Ms = percentile(timings, 95);
    console.log(
      `[tree-view] rows=${rowCount} cold=${coldMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms budget=${CLICK_BUDGET_MS}ms`,
    );
    expect(rowCount).toBe(itemCount + 4);
    expect(coldMs).toBeLessThan(CLICK_BUDGET_MS);
    expect(p95Ms).toBeLessThan(CLICK_BUDGET_MS);
  });

  it(`generates a click path on a deep node under ${CLICK_BUDGET_MS}ms cold and p95`, () => {
    let target = model.root;
    while (target.children !== null && target.children.length > 0) {
      target = target.children[target.children.length - 1];
    }
    const timings: number[] = [];
    let expression = "";
    for (let i = 0; i < CLICK_SAMPLES; i++) {
      const start = performance.now();
      const result = pathTo(target);
      expect(result.kind).toBe("path");
      if (result.kind === "path") expression = printPath(result.segments);
      timings.push(performance.now() - start);
    }
    const coldMs = timings[0];
    const p95Ms = percentile(timings, 95);
    console.log(
      `[tree-view] click-path="${expression.slice(0, 60)}" cold=${coldMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms budget=${CLICK_BUDGET_MS}ms`,
    );
    expect(expression.startsWith(".")).toBe(true);
    expect(coldMs).toBeLessThan(CLICK_BUDGET_MS);
    expect(p95Ms).toBeLessThan(CLICK_BUDGET_MS);
  });
});
