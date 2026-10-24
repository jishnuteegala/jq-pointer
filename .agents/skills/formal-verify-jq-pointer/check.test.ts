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
  // Left-to-right DFS; the root itself is included - it is a real clickable
  // row (the "$" row) and exercises the empty-steps "." print/parse boundary.
  while ((node = stack.pop()) !== undefined) {
    if (node.jqAddressable) out.push(node);
    for (const child of (node.children ?? []).toReversed()) stack.push(child);
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

// Deterministic click sets: singles, arbitrary pairs (first-C(n,2) capped),
// same-array-ancestor pairs and triples, and construction pairs (sibling keys).
// Triples matter: generaliseOverAncestor's merge loop has continuation logic a
// pair can never reach.
function clickSets(nodes: ModelNode[]): ModelNode[][] {
  const sets: ModelNode[][] = [];
  for (const n of nodes.slice(0, 8)) sets.push([n]);
  const pairCap = Math.min(40, (nodes.length * (nodes.length - 1)) / 2);
  let pairs = 0;
  outer: for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (pairs >= pairCap) break outer;
      sets.push([nodes[i], nodes[j]]);
      pairs++;
    }
  }
  const byArray = new Map<ModelNode, ModelNode[]>();
  for (const n of nodes) {
    const a = firstArrayAncestor(n);
    if (a === null) continue;
    byArray.set(a, [...(byArray.get(a) ?? []), n]);
  }
  for (const group of byArray.values()) {
    for (let i = 0; i + 1 < group.length && i < 6; i += 2) {
      sets.push([group[i], group[i + 1]]);
    }
    for (let i = 0; i + 2 < group.length && i < 6; i += 3) {
      sets.push([group[i], group[i + 1], group[i + 2]]);
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
      sets.push([sibs[i], sibs[i + 1]]);
    }
  }
  return sets;
}

// --- invariants -----------------------------------------------------------

function checkSelection(root: ModelNode, clicks: ModelNode[], bad: string[], tag: string) {
  for (const ancestorIndex of [0, 1, 2, 3]) {
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
        continue;
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
      try {
        const reparsed = parseExpression(printed);
        expect(reparsed).toEqual(output.expression);
      } catch {
        bad.push(`${tag} ${printed}: parse(print(e)) failed`);
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
            try {
              const reparsed = parseExpression(printExpression(output.expression));
              expect(reparsed).toEqual(output.expression);
            } catch (err) {
              bad.push(
                `${printExpression(output.expression)}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
              );
            }
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(bad).toEqual([]);
  });

  it("J6 merge: same-array same-key clicks emit one generalized output", () => {
    // The headline feature: clicking fields of the same key inside a shared
    // array must emit a single `.items[].name`-style expression, not per-click
    // outputs. J1-J5 pass on an impl that always returns separateOutputs -
    // these assertions are the only pin on merging actually happening.
    const bad: string[] = [];
    const expectOne = (clicks: ModelNode[], ancestorIndex: number, tag: string) => {
      const sel = resolveSelection(clicks, ancestorIndex);
      if (sel.outputs.length !== 1) bad.push(`${tag}: ${sel.outputs.length} outputs, want 1`);
      return sel;
    };

    // Every same-key pair sharing a first array ancestor, over every curated
    // doc - not just the first doc's `name` group.
    let pairAssertions = 0;
    for (const doc of CURATED) {
      const model = buildPathModel(doc);
      const keyed = clickable(model.root).filter((n) => n.segment?.kind === "key");
      for (let i = 0; i < keyed.length; i++) {
        for (let j = i + 1; j < keyed.length; j++) {
          const a = keyed[i];
          const b = keyed[j];
          if (
            a?.segment?.kind === "key" &&
            b?.segment?.kind === "key" &&
            a.segment.key === b.segment.key &&
            firstArrayAncestor(a) !== null &&
            firstArrayAncestor(a) === firstArrayAncestor(b)
          ) {
            pairAssertions++;
            expectOne([a, b], 0, `doc${CURATED.indexOf(doc)} pair ${a.segment.key}`);
          }
        }
      }
    }
    // Vacuity guard: if the curated docs drift so no same-ancestor same-key
    // pair exists, this test must fail rather than pass on nothing.
    if (pairAssertions === 0) bad.push("J6 asserted no same-ancestor pair - curated docs drifted");

    // Widened and cross-inner merges: CURATED[1] nests two arrays under one
    // outer array, so same-key clicks share one or two array ancestors.
    const nested = buildPathModel(CURATED[1]);
    const names = clickable(nested.root).filter(
      (n) => n.segment?.kind === "key" && n.segment.key === "name",
    );
    expect(names.length).toBe(3);
    const byAncestor = new Map<ModelNode, ModelNode[]>();
    for (const n of names) {
      const a = firstArrayAncestor(n);
      if (a !== null) byAncestor.set(a, [...(byAncestor.get(a) ?? []), n]);
    }
    const innerPair = [...byAncestor.values()].find((g) => g.length === 2);
    const loner = [...byAncestor.values()].find((g) => g.length === 1)?.[0];
    if (innerPair === undefined || loner === undefined) {
      bad.push("CURATED[1] drifted - expected a 2-node and a 1-node name group");
    } else {
      const [x, y] = innerPair;
      expectOne([x, y], 1, "same-inner pair widened to outer ancestor");
      expectOne([x, loner], 0, "cross-inner pair sharing only the outer array");
    }

    // Triples: merge continuation logic a pair can never reach.
    const tripleDoc = buildPathModel({ rows: [{ v: 1 }, { v: 2 }, { v: 3 }] });
    const vs = clickable(tripleDoc.root).filter(
      (n) => n.segment?.kind === "key" && n.segment.key === "v",
    );
    expect(vs.length).toBe(3);
    if (vs[0] !== undefined && vs[1] !== undefined && vs[2] !== undefined) {
      expectOne([vs[0], vs[1], vs[2]], 0, "same-array same-key triple");
    }

    // Construction: sibling keys under one object emit a construction
    // expression, not separate paths.
    const usersDoc = buildPathModel(CURATED[5]);
    const ids = clickable(usersDoc.root).filter(
      (n) => n.segment?.kind === "key" && n.segment.key === "id",
    );
    const tags = clickable(usersDoc.root).filter(
      (n) => n.segment?.kind === "key" && n.segment.key === "tags",
    );
    if (ids[0] === undefined || tags[0] === undefined) {
      bad.push("CURATED[5] drifted - expected id and tags sibling keys");
    } else {
      const sel = expectOne([ids[0], tags[0]], 0, "sibling-key construction pair");
      if (sel.outputs[0]?.expression.kind !== "construction")
        bad.push(`sibling-key pair emitted ${sel.outputs[0]?.expression.kind}, want construction`);
    }

    expect(bad).toEqual([]);
  });
});
