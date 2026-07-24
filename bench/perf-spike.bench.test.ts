import { describe, expect, it } from 'vitest';
import { generateFixture } from './fixture';
import {
  buildPathModel,
  commonArrayAncestor,
  evaluateSteps,
  type ModelNode,
  type PathStep,
} from '../src/lib/path-model';
import type { JsonValue } from '../src/lib/json-value';

const TARGET_BYTES = 10 * 1024 * 1024;
const INTERACTIVE_BUDGET_MS = 2000;
const CLICK_BUDGET_MS = 100;
const CLICK_SAMPLES = 50;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe('D7 performance spike: 10MB parse + path model + click evaluation', () => {
  const { json, itemCount } = generateFixture(TARGET_BYTES);

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

  it(`evaluates a click-pair generalisation under ${CLICK_BUDGET_MS}ms`, () => {
    const parsed = JSON.parse(json) as JsonValue;
    const model = buildPathModel(parsed);
    const itemsNode = model.root.children?.find(
      (child) => child.segment?.kind === 'key' && child.segment.key === 'items',
    );
    expect(itemsNode).toBeDefined();
    const items = itemsNode as ModelNode;
    const first = items.children?.[0];
    const last = items.children?.[items.children.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    const ancestor = commonArrayAncestor(first as ModelNode, last as ModelNode);
    expect(ancestor).toBe(items);

    const steps: PathStep[] = [
      { kind: 'iterate' },
      { kind: 'key', key: 'meta' },
      { kind: 'key', key: 'owner' },
      { kind: 'key', key: 'login' },
    ];

    const timings: number[] = [];
    let resultCount = 0;
    for (let i = 0; i < CLICK_SAMPLES; i++) {
      const start = performance.now();
      const results = evaluateSteps(items, steps);
      timings.push(performance.now() - start);
      resultCount = results.length;
    }

    const medianMs = median(timings);
    const maxMs = Math.max(...timings);
    console.log(
      `[perf-spike] click-eval matches=${resultCount}/${itemCount} median=${medianMs.toFixed(2)}ms max=${maxMs.toFixed(2)}ms budget=${CLICK_BUDGET_MS}ms`,
    );

    expect(resultCount).toBe(itemCount);
    expect(medianMs).toBeLessThan(CLICK_BUDGET_MS);
  });
});
