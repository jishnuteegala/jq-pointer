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
   is measured: the ancestor is the full 22k-element array. The executable
   gate uses one `CLICK_BUDGET_MS = 100` constant for cold (first run),
   median, and p95 of 50 runs,
   so a JIT-warm median cannot mask a slow first click and recurring slow
   runs cannot hide behind the median; the absolute max is reported as
   diagnostic output but not asserted, so a single scheduler pause on a
   shared CI runner cannot flake the suite.
3. **NDJSON parse**: the same seeded records serialized one per line and
   parsed through `parseDocument` under the same 2s budget. The fixture stays
   just below the shared 10MB input cap.

## Measured results

Local run (Node 20, Windows, 2026-07-24):

| Measurement                                                       | Result                             | Budget                           | Verdict             |
| ----------------------------------------------------------------- | ---------------------------------- | -------------------------------- | ------------------- |
| `JSON.parse` of 10.00MB                                           | ~122ms                             | part of 2s                       | pass                |
| Path model build (684,724 nodes)                                  | ~123ms                             | part of 2s                       | pass                |
| Total to interactive model                                        | ~245ms                             | < 2000ms                         | pass (~8x headroom) |
| Click-pair pipeline (`.items[].meta.owner.login`, 22,235 matches) | ~13ms cold, ~9ms median, ~26ms p95 | < 100ms at cold, median, and p95 | pass                |

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

- Ticket #8's in-browser end-to-end re-measurement (mandatory, above):
  **done, see below**.
- Any future feature pushing the benchmark's click-pipeline p95 past 50ms:
  adopt the worker before shipping that feature.

## Ticket #8 in-browser re-measurement

Measured against the rendered virtualised tree in Chromium (Playwright,
Vite dev server, 2026-07-25), using the same seeded ~10MB fixture pasted
into the input:

| Measurement                                            | Result | Budget   | Verdict |
| ------------------------------------------------------ | ------ | -------- | ------- |
| Paste 10MB to interactive rendered tree                | ~345ms | < 2000ms | pass    |
| Click expanding the 22k-element array (path + repaint) | ~64ms  | < 100ms  | pass    |
| Scroll to the middle of the virtualised list (repaint) | ~30ms  | < 100ms  | pass    |
| Click a mid-list element (path generation + highlight) | ~31ms  | < 100ms  | pass    |

The DOM holds only visible rows plus overscan (~38 elements for 22k
visible-row entries), confirming render cost is independent of document
size. One implementation note: React-controlled textarea updates with a
10MB string cost ~2s in layout, so documents beyond 256KB are loaded via
the paste/drop handlers and the textarea shows a placeholder summary
instead of the raw text. The budgets hold on the main thread; no worker
is adopted and the ~10MB cap stands.
