# D7 performance spike result

The spec's day-1 spike gate: parse a ~10MB JSON document, build the internal
path model, and measure time-to-interactive-tree and per-click evaluation
cost.

## Harness

`bench/perf-spike.bench.test.ts`, run via `pnpm bench` (also part of the
normal `pnpm test` suite, so CI re-checks the budget on every push and PR).
The ~10MB fixture is generated at test time by `bench/fixture.ts` from a
seeded PRNG (deterministic, never committed): a list envelope of ~22k
records with nested objects, arrays, heterogeneous optional keys,
non-identifier keys, and nulls, shaped like the spec's corpus documents
(GitHub/Stripe/Kubernetes list payloads).

## Measured results

Local run (Node 20, Windows, 2026-07-24):

| Measurement | Result | Budget | Verdict |
| --- | --- | --- | --- |
| `JSON.parse` of 10.00MB | ~122ms | part of 2s | pass |
| Path model build (684,724 nodes) | ~123ms | part of 2s | pass |
| Total to interactive model | ~245ms | < 2000ms | pass (~8x headroom) |
| Click-pair evaluation (`.items[].meta.owner.login`, 22,235 matches, median of 50 runs) | ~9ms median, ~25ms max | < 100ms | pass |

The click evaluation measured here iterates the full 22k-element array —
the worst case. The spec additionally scopes click evaluation to the common
ancestor's subtree, so real interactions will typically evaluate far less.

## Decision

**Evaluation stays on the main thread. The ~10MB cap holds.**

Per the spec's cut order (main thread, else worker, else lower cap), the
first option passes with roughly 8x headroom on time-to-interactive and 10x
on click evaluation, so no worker is adopted and the cap is not lowered.

Downstream tickets can rely on:

- `src/lib/path-model.ts` builds a parent-linked node model in a single
  iterative pass (no recursion, so depth never overflows the stack).
- `buildPathModel`, `evaluateSteps`, `pathTo`, and `commonArrayAncestor`
  are the primitives for path generation, live preview, and click-pair
  generalisation.
- The budget assertions live in the test suite; a regression that blows
  the budget fails CI.

Revisit trigger: if a future feature (e.g. reverse-highlight over very
large documents) pushes measured evaluation past ~50ms median in the
benchmark, adopt the worker before shipping that feature.
