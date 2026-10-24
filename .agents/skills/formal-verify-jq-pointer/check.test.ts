import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import type { JsonValue } from "../../../src/lib/json-value";
import { buildPathModel, type ModelNode } from "../../../src/lib/path-model";
import { resolveSelection } from "../../../src/lib/selection";
import {
  evaluateExpression,
  evaluateJqExpression,
  parseExpression,
  printExpression,
} from "../../../src/lib/jq-expression";

// Property verifier for the click -> jq-expression pipeline
// (src/lib/selection.ts + jq-expression.ts + path-model.ts).
// The promise to the user: the expression jq-pointer emits selects exactly
// what the UI highlights - never less (a click silently lost) and never a
// TypeError on real jq (an expression that crashes the user's pipeline).

// --- click sampling -------------------------------------------------------

function clickable(root: ModelNode): ModelNode[] {
  const out: ModelNode[] = [];
  const stack: ModelNode[] = [root];
  let node: ModelNode | undefined;
  while ((node = stack.pop()) !== undefined) {
    if (node.exists && node.jqAddressable && node.segment !== null) out.push(node);
    for (const child of node.children ?? []) stack.push(child);
  }
  return out;
}

function firstArrayAncestor(node: ModelNode): ModelNode | null {
  let current = node.parent;
  while (current !== null) {
    if (Array.isArray(current.value)) return current;
    current = current.parent;
  }
  return null;
}

// Deterministic click sets: singles, arbitrary pairs (stride-sampled),
// same-array-ancestor pairs, and construction pairs (sibling keys).
function clickSets(nodes: ModelNode[]): ModelNode[][] {
  const sets: ModelNode[][] = [];
  for (const n of nodes.slice(0, 8)) sets.push([n]);
  const pairCap = Math.min(40, (nodes.length * (nodes.length - 1)) / 2);
  for (let i = 0; i < pairCap; i++) {
    const a = nodes[(i * 7) % nodes.length];
    const b = nodes[(i * 13 + 5) % nodes.length];
    if (a !== b) sets.push([a, b]);
  }
  const byArray = new Map<ModelNode, ModelNode[]>();
  for (const n of nodes) {
    const a = firstArrayAncestor(n);
    if (a === null) continue;
    byArray.set(a, [...(byArray.get(a) ?? []), n]);
  }
  for (const group of byArray.values()) {
    for (let i = 0; i + 1 < group.length && i < 6; i += 2) {
      if (group[i] !== group[i + 1]) sets.push([group[i], group[i + 1]]);
    }
  }
  const parents = new Map<ModelNode, ModelNode[]>();
  for (const n of nodes) {
    if (n.parent !== null && n.segment?.kind === "key") {
      parents.set(n.parent, [...(parents.get(n.parent) ?? []), n]);
    }
  }
  for (const sibs of parents.values()) {
    for (let i = 0; i + 1 < sibs.length && i < 4; i += 2) {
      if (sibs[i] !== sibs[i + 1]) sets.push([sibs[i], sibs[i + 1]]);
    }
  }
  return sets;
}

// --- invariants -----------------------------------------------------------

function checkSelection(root: ModelNode, clicks: ModelNode[], bad: string[], tag: string) {
  for (const ancestorIndex of [0, 1, 2]) {
    const sel = resolveSelection(clicks, ancestorIndex);
    // J1: every click appears in the union of all outputs' evaluations.
    // (separateOutputs emits one output per click - coverage is collective.)
    const allHits = new Set<ModelNode>();
    for (const output of sel.outputs) {
      try {
        for (const node of evaluateJqExpression(root, output.expression)) allHits.add(node);
      } catch {
        // counted per-output below
      }
    }
    if (sel.unsupportedCount > 0)
      bad.push(`${tag}: unsupportedCount=${sel.unsupportedCount} for addressable clicks`);
    for (const click of clicks) {
      if (!allHits.has(click))
        bad.push(
          `${tag} clicks->${sel.outputs.map((o) => printExpression(o.expression)).join(" ; ")}: a click is in no output's evaluation`,
        );
    }
    for (const output of sel.outputs) {
      const printed = printExpression(output.expression);

      // J3: evaluation never throws.
      try {
        evaluateJqExpression(root, output.expression);
      } catch (error) {
        bad.push(`${tag} ${printed}: threw ${String(error)}`);
        continue;
      }

      // J2: highlight fidelity - evaluateExpression == output.matches, and
      // the count/heterogeneity fields agree.
      let highlights: ModelNode[] = [];
      try {
        highlights = evaluateExpression(root, output.expression);
      } catch (error) {
        bad.push(`${tag} ${printed}: highlight eval threw ${String(error)}`);
      }
      const matchSet = new Set(output.matches);
      if (highlights.length !== matchSet.size || !highlights.every((node) => matchSet.has(node))) {
        bad.push(
          `${tag} ${printed}: matches (${output.matches.length}) != evaluated highlights (${highlights.length})`,
        );
      }
      if (output.matchCount > output.elementCount)
        bad.push(
          `${tag} ${printed}: matchCount ${output.matchCount} > elementCount ${output.elementCount}`,
        );
      if (output.heterogeneous !== output.matchCount < output.elementCount)
        bad.push(
          `${tag} ${printed}: heterogeneous=${output.heterogeneous} but ${output.matchCount}/${output.elementCount}`,
        );

      // J4: printed expressions round-trip through the strict parser.
      const reparsed = parseExpression(printed);
      try {
        expect(reparsed).toEqual(output.expression);
      } catch {
        bad.push(`${tag} ${printed}: parse(print(e)) != e (${JSON.stringify(reparsed)})`);
      }
    }
  }
}

const CURATED: JsonValue[] = [
  { items: [{ name: "a" }, { name: "b", extra: 1 }, 5, null] },
  { items: [[{ name: "x" }, { name: "y" }], [{ name: "z" }]] },
  { if: 1, "a b": 2, "2fa": 3, '"q"': 4, nested: { while: [1, 2] } },
  { a: [1, [2, [3, [4]]]], b: { c: { d: 7 } } },
  [1, "two", { three: 3 }, [4], null],
  {
    users: [
      { id: 1, tags: ["x"] },
      { id: 2, tags: ["y", "z"] },
    ],
  },
];

describe("formal verify: selection pipeline", () => {
  it("J1-J4 hold over curated documents", () => {
    const bad: string[] = [];
    for (const doc of CURATED) {
      const model = buildPathModel(doc);
      for (const clicks of clickSets(clickable(model.root))) {
        checkSelection(model.root, clicks, bad, "curated");
      }
    }
    expect(bad).toEqual([]);
  });

  it("J1-J4 hold over generated documents", () => {
    const bad: string[] = [];
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (doc) => {
        const model = buildPathModel(doc as JsonValue);
        for (const clicks of clickSets(clickable(model.root))) {
          checkSelection(model.root, clicks, bad, `doc=${JSON.stringify(doc)?.slice(0, 120)}`);
        }
      }),
      { numRuns: 150 },
    );
    expect(bad).toEqual([]);
  });

  it("J5 single-click paths round-trip and never throw", () => {
    const bad: string[] = [];
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 3 }), (doc) => {
        const model = buildPathModel(doc as JsonValue);
        for (const node of clickable(model.root)) {
          const sel = resolveSelection([node]);
          for (const output of sel.outputs) {
            try {
              evaluateJqExpression(model.root, output.expression);
            } catch (error) {
              bad.push(`${printExpression(output.expression)}: threw ${String(error)}`);
            }
            const reparsed = parseExpression(printExpression(output.expression));
            try {
              expect(reparsed).toEqual(output.expression);
            } catch {
              bad.push(`${printExpression(output.expression)}: no round-trip`);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(bad).toEqual([]);
  });
});
