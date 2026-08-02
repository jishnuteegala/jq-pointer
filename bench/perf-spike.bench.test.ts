import { describe, expect, it } from "vitest";
import { generateFixture, generateNdjsonFixture } from "./fixture";
import { runClickPair } from "./click-pipeline";
import { buildPathModel, type ModelNode } from "../src/lib/path-model";
import type { JsonValue } from "../src/lib/json-value";
import { coldStart, percentile } from "./stats";
import { parseDocument } from "../src/lib/parse-document";

const TARGET_BYTES = 10 * 1024 * 1024;
const INTERACTIVE_BUDGET_MS = 2000;
const CLICK_BUDGET_MS = 100;
const CLICK_SAMPLES = 50;

function descend(node: ModelNode, keys: string[]): ModelNode {
  let current = node;
  for (const key of keys) {
    const found = current.children?.find(
      (child) => child.segment?.kind === "key" && child.segment.key === key,
    );
    if (found === undefined) throw new Error(`missing key ${key}`);
    current = found;
  }
  return current;
}

describe("D7 performance spike: 10MB parse + path model + click evaluation", () => {
  const { json, itemCount } = generateFixture(TARGET_BYTES);
  const { ndjson, itemCount: ndjsonCount } = generateNdjsonFixture(TARGET_BYTES * 0.99);

  it(`parses ~10MB NDJSON under ${INTERACTIVE_BUDGET_MS}ms`, () => {
    const start = performance.now();
    const outcome = parseDocument(ndjson);
    const elapsed = performance.now() - start;
    expect(outcome.kind).toBe("ndjson");
    if (outcome.kind === "ndjson") expect(outcome.records).toHaveLength(ndjsonCount);
    expect(ndjson.length).toBeGreaterThan(TARGET_BYTES * 0.95);
    expect(elapsed).toBeLessThan(INTERACTIVE_BUDGET_MS);
  });

  it(`parses ~10MB and builds the path model under ${INTERACTIVE_BUDGET_MS}ms`, () => {
    const parseStart = performance.now();
    const parsed = JSON.parse(json) as JsonValue;
    const parseMs = performance.now() - parseStart;

    const buildStart = performance.now();
    const model = buildPathModel(parsed);
    const buildMs = performance.now() - buildStart;

    const totalMs = parseMs + buildMs;
    console.log(
      `[perf-spike] fixture=${(json.length / 1024 / 1024).toFixed(2)}MB items=${itemCount} nodes=${model.nodeCount}`,
    );
    console.log(
      `[perf-spike] parse=${parseMs.toFixed(1)}ms build=${buildMs.toFixed(1)}ms total=${totalMs.toFixed(1)}ms budget=${INTERACTIVE_BUDGET_MS}ms`,
    );

    expect(json.length).toBeGreaterThan(TARGET_BYTES * 0.95);
    expect(model.nodeCount).toBeGreaterThan(itemCount);
    expect(totalMs).toBeLessThan(INTERACTIVE_BUDGET_MS);
  });

  it(`runs the full click-pair pipeline with median and p95 under ${CLICK_BUDGET_MS}ms`, () => {
    const parsed = JSON.parse(json) as JsonValue;
    const model = buildPathModel(parsed);
    const items = descend(model.root, ["items"]);
    const elements = items.children;
    expect(elements).not.toBeNull();
    const first = descend((elements as ModelNode[])[0], ["meta", "owner", "login"]);
    const last = descend((elements as ModelNode[])[(elements as ModelNode[]).length - 1], [
      "meta",
      "owner",
      "login",
    ]);

    const timings: number[] = [];
    let matchCount = 0;
    for (let i = 0; i < CLICK_SAMPLES; i++) {
      const start = performance.now();
      const result = runClickPair(first, last);
      timings.push(performance.now() - start);
      expect(result).not.toBeNull();
      expect(result?.ancestor).toBe(items);
      matchCount = result?.matches.length ?? 0;
    }

    const coldMs = coldStart(timings);
    const medianMs = percentile(timings, 50);
    const p95Ms = percentile(timings, 95);
    const maxMs = Math.max(...timings);
    console.log(
      `[perf-spike] click-pipeline matches=${matchCount}/${itemCount} cold=${coldMs.toFixed(2)}ms median=${medianMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms max=${maxMs.toFixed(2)}ms budget=${CLICK_BUDGET_MS}ms`,
    );

    expect(matchCount).toBe(itemCount);
    expect(medianMs).toBeLessThan(CLICK_BUDGET_MS);
    expect(p95Ms).toBeLessThan(CLICK_BUDGET_MS);
    expect(coldMs).toBeLessThan(CLICK_BUDGET_MS);
  });

  it(`runs the NDJSON click-pair pipeline with cold, median, and p95 under ${CLICK_BUDGET_MS}ms`, () => {
    const outcome = parseDocument(ndjson);
    expect(outcome.kind).toBe("ndjson");
    if (outcome.kind !== "ndjson") return;
    const model = buildPathModel(outcome.records[0].value);
    const labels = descend(model.root, ["meta", "labels"]);
    const elements = labels.children;
    expect(elements).not.toBeNull();
    const first = descend((elements as ModelNode[])[0], ["name"]);
    const last = descend((elements as ModelNode[])[(elements as ModelNode[]).length - 1], ["name"]);

    const timings: number[] = [];
    let matchCount = 0;
    for (let i = 0; i < CLICK_SAMPLES; i++) {
      const start = performance.now();
      const result = runClickPair(first, last);
      timings.push(performance.now() - start);
      expect(result).not.toBeNull();
      expect(result?.ancestor).toBe(labels);
      matchCount = result?.matches.length ?? 0;
    }

    const coldMs = coldStart(timings);
    const medianMs = percentile(timings, 50);
    const p95Ms = percentile(timings, 95);
    console.log(
      `[perf-spike] ndjson-click-pipeline matches=${matchCount}/3 cold=${coldMs.toFixed(2)}ms median=${medianMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms budget=${CLICK_BUDGET_MS}ms`,
    );

    expect(matchCount).toBe(3);
    expect(coldMs).toBeLessThan(CLICK_BUDGET_MS);
    expect(medianMs).toBeLessThan(CLICK_BUDGET_MS);
    expect(p95Ms).toBeLessThan(CLICK_BUDGET_MS);
  });
});
