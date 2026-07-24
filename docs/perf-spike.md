# D7 performance spike result

The spec's day-1 spike gate: parse a ~10MB JSON document, build the internal
path model, and measure time-to-interactive-tree and per-click evaluation
cost. Per spec section 6, the spike is "parse a 10MB document and build the
path model"; this document records what was measured, what the verdict
covers, and what remains to be re-verified once the tree UI exists.

## Harness

`bench/perf-spike.bench.test.ts`, run via `pnpm bench` (also part of the
normal `pnpm test` suite, so CI re-checks the budget on every push and PR).
The ~10MB fixture is generated at test time by `bench/fixture.ts` from a
seeded PRNG (deterministic, never committed): a list envelope of ~22k
records with nested objects, arrays, heterogeneous optional keys,
non-identifier keys, and nulls, shaped like the spec's corpus documents
(GitHub/Stripe/Kubernetes list payloads).

Two measurements:

1. **Time to interactive model**: `JSON.parse` of the 10MB string plus
   `buildPathModel` over the parsed value.
2. **Click-pair pipeline**: the full data path a click-pair triggers -
   common-array-ancestor detection, path extraction for both nodes,
   segment-wise generalisation, and evaluation of the generalised steps
   over the ancestor's subtree (`bench/click-pipeline.ts`). The worst case
   is measured: the ancestor is the full 22k-element array. Cold (first
   run), median, and max of 50 runs are all asserted against the 100ms
   budget, so a JIT-warm median cannot mask a slow first click.

## Measured results

Local run (Node 20, Windows, 2026-07-24):

| Measurement | Result | Budget | Verdict |
| --- | --- | --- | --- |
| `JSON.parse` of 10.00MB | ~122ms | part of 2s | pass |
| Path model build (684,724 nodes) | ~123ms | part of 2s | pass |
| Total to interactive model | ~245ms | < 2000ms | pass (~8x headroom) |
| Click-pair pipeline (`.items[].meta.owner.login`, 22,235 matches) | ~13ms cold, ~9ms median, ~26ms max | < 100ms each | pass |

## Scope of the measurement

The harness runs in Node, not a browser, and measures the data layer only:
no React rendering, virtualization, or paint is included, because the tree
view does not exist yet (ticket #8). Node and browser main threads share
the same V8 engine, so parse/build times are representative of browser
main-thread cost; rendering cost is not covered by this spike.

The rendering risk is bounded by a spec-level constraint: the tree is
virtualised from day one, so render cost is proportional to visible rows
(tens of nodes), not document size. The document-size-dependent costs -
parse, model build, evaluation - are exactly what this spike measures, and
they pass with ~8x headroom.

## Decision

**Evaluation stays on the main thread. The ~10MB cap holds.**

Per the spec's cut order (main thread, else worker, else lower cap), the
first option passes with roughly 8x headroom on time-to-interactive-model
and 4x on worst-case click evaluation, so no worker is adopted and the cap
is not lowered.

This decision carries one explicit re-verification gate: **ticket #8 (tree
view) must re-measure time-to-interactive and per-click latency end-to-end
in a real browser against the rendered virtualised tree** before that
ticket closes. If the end-to-end measurement blows the budget, the worker
fallback is adopted at that point, before any cap change.

Downstream tickets can rely on:

- `src/lib/path-model.ts` builds a parent-linked node model in a single
  iterative pass (no recursion, so depth never overflows the stack).
- `buildPathModel`, `evaluateSteps`, `pathTo`, and `commonArrayAncestor`
  are the primitives for path generation, live preview, and click-pair
  generalisation.
- The budget assertions live in the test suite; a regression that blows
  the budget fails CI.

Revisit triggers:

- Ticket #8's in-browser end-to-end re-measurement (mandatory, above).
- Any future feature pushing the benchmark's click-pipeline max past 50ms:
  adopt the worker before shipping that feature.
