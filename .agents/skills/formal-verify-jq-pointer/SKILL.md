---
name: formal-verify-jq-pointer
description: "Verify jq-pointer's click-to-expression pipeline (src/lib/selection.ts, jq-expression.ts, path-model.ts) over generated documents - emitted jq must select every click, match the UI highlight set exactly, never throw, and round-trip through its own parser. Run after any change to the lib pipeline."
---

# Formal verify: selection pipeline

## What it proves

The contract is the product: an expression jq-pointer emits selects exactly what the UI highlights - never less (a clicked node silently dropped means the copied query misses data the user saw selected) and never a `TypeError` (an emitted expression that crashes real jq on a heterogeneous document is a broken promise the UI can't see). The subtle bugs live in generalization: `mergeSegment` collapsing `[0]`/`[2]` into `[0]` loses all clicks after the first.

`check.test.ts` runs the **real** `buildPathModel`/`resolveSelection`/`evaluateJqExpression`/`evaluateExpression`/`printExpression`/`parseExpression` over 150 generated documents (fast-check `jsonValue`, maxDepth 4) plus 6 curated hostile ones (heterogeneous arrays, nested iteration, jq keywords/quoted/space/leading-digit keys), and 100 more documents at maxDepth 3 for J5's single-click round-trips. Clickables include the root `"$"` row, which exercises the empty-path `"."` print/parse boundary. Per document it samples up to 8 singles, up to 40 unordered i<j pairs (first C(n,2)), same-array-ancestor pairs and triples (3 pairs + 2 triples per group; triples reach merge-continuation logic pairs cannot), and sibling-key construction pairs (2 per parent), and sweeps `ancestorIndex` 0-3. J1: every click is in some output's evaluation (union - `separateOutputs` emits one output per click). J2: `evaluateExpression` equals `output.matches` exactly, `matchCount <= elementCount`, `heterogeneous === (matchCount < elementCount)` - self-consistency assertions, provable by construction, kept as regression guards. J3: `evaluateJqExpression` never throws. J4: `parseExpression(printExpression(e))` deep-equals `e`. J5: single-click paths round-trip. J6: the merge pin - every same-key pair sharing an array ancestor over all curated docs must emit one generalized output (vacuity-guarded), plus a widened-ancestor merge, a cross-inner-array merge, a same-key triple, and a sibling-key pair asserting `kind === "construction"`. An impl that always emits `separateOutputs` passes J1-J5 but fails J6.

## Run

```bash
pnpm vitest run --config .agents/skills/formal-verify-jq-pointer/vitest.config.ts
```

Needs the repo's vitest + fast-check (both devDeps already). The bundled `vitest.config.ts` is required: the repo's own vitest projects only include `src/**` and `bench/**`, so the check carries its own config rooted at the skill dir with the node environment (the pipeline is pure). ~6s wall.

No repo tsconfig covers `.agents/`, and vitest transpiles without typechecking - run the bundled typecheck after edits (it covers both `check.test.ts` and `vitest.config.ts`):

```bash
pnpm exec tsc -p .agents/skills/formal-verify-jq-pointer/tsconfig.json
```

## Coverage record

| Covered                    | Functions                                                                                                                                                                  | Notes                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `src/lib/selection.ts`     | `resolveSelection`, `resolveSelectionAt`, `generaliseOverAncestor`, `resolveConstruction`, `separateOutputs`, `singlePathOutput`, `finaliseGeneralisation`, `mergeSegment` | all output kinds incl. `construction`  |
| `src/lib/jq-expression.ts` | `evaluateJqExpression`, `evaluateExpression`, `printExpression`, `parseExpression`                                                                                         | eval fidelity + print/parse round-trip |
| `src/lib/path-model.ts`    | `buildPathModel`, `pathTo`, `evaluateSteps`, `evaluateTrace`                                                                                                               | via the pipeline                       |

**Sync commit:** `8eed533` (committed 2026-10-10; verified in sync on 2026-10-24). Move this forward only after re-running the check and confirming the invariants describe the code at the new commit.

Not covered, on purpose: real-jq oracle comparison (`evaluateJqExpression` is the self-consistency oracle; a jq binary comparison is documented in `jq-oracle.test.ts` but platform-skipped on Windows), `parseDocument`/NDJSON input handling, and all UI code. `ancestorIndex` is swept but the breadcrumb metadata shape itself is not asserted.

## Reading a failure

Failures print the printed expression and the doc prefix. `click is in no output's evaluation` = generalization dropped a click (suspect `mergeSegment`/`finaliseGeneralisation`). `matches != evaluated highlights` = the `OutputEntry` bookkeeping disagrees with the evaluator. `threw` = a missing `optional` marker on a step. `no round-trip` = `printExpression` emitted something `parseExpression` can't re-read. If the printed expression genuinely selects the click but evaluation disagrees, the evaluator (`evaluateSteps`/`applyStep`) is the suspect - check `nullNode`/`exists` handling.

## Updating the verification

When a change is intended (a new output kind, a new step type, different generalization rules - evidence in the change: tests, commit message, docs), update all of: `clickSets` (sample whatever drives the new path), the invariant list, and `CURATED` with a doc that exercises the new shape. Then break the code the way the property guards against (`mergeSegment` returning `a` unconditionally is the canonical break) and confirm a failure appears before restoring. Record the new sync commit above.
