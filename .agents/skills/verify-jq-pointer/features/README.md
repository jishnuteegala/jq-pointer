# jq-pointer verification map

This directory is the maintained source for verifying the user-facing behaviour of jq-pointer. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- jq-pointer is served at `http://localhost:4199` by a server this run started (dev or preview, per `../SKILL.md` Launch).
- Doctor has passed: `<title>jq-pointer</title>` on `/` and `# jq-pointer` as the first line of `/llms.txt`.
- `pw-jqp` is bootstrapped: playwright-core 1.64.0 in `$PW_DIR`, commands run from that directory.
- `node "$HELPER" launch http://localhost:4199/ "$EVIDENCE_DIR"` has run and `pw-state.json` exists.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position; `role=button[name="Expand items"]` beats `.tree-toggle`.
- Treat every command as literal. Keep quoted names, selectors, and fixture JSON unchanged.
- All commands go through `node "$HELPER" <step>` (the `pw-jqp` script) from `$PW_DIR`.
- The app parses on every input change; after `fill`, the tree, path output, and status lines update without further action. Wait on the expected text appearing, not on a fixed sleep.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an `aria` dump and a `shot` screenshot with the jq-pointer wordmark visible.
- State proof includes the printed `text` of the asserted element saved to `proof.txt` alongside the command that produced it.
- Clipboard proof requires either the read-back value or the `Copied` label state; a button screenshot alone is not proof.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behaviour. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behaviour.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with pw-jqp` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Build a path from clicks](./build-path-from-clicks.md) covers paste-to-tree, click selection, generalisation, chips, breadcrumb widening, and Clear.
- [Copy jq expressions](./copy-expressions.md) covers the bare-expression copy for JSON, the `jq`/`jq -s` invocations for NDJSON, and the Copied state.
- [NDJSON records](./ndjson-records.md) covers record detection, navigation between records, and bad-line notes.
- [Filter highlighting](./filter-highlight.md) covers matching-node highlight, empty match, unsupported filters, and runtime errors.
- [Input errors](./input-errors.md) covers invalid JSON alerts, the ~10MB cap, and the empty-input state.
