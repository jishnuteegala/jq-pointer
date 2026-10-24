# Copy jq expressions

Copy lets a user put the jq expression for the current selection on the clipboard: the bare expression for a JSON document, or shell-ready `jq '<expr>'` / `jq -s '<expr>'` invocations for NDJSON input.

## Sub-features

- `copy-plain` copies the bare jq expression for a single JSON document.
- `copy-per-line` copies `jq '<expression>'` for each NDJSON record.
- `copy-slurped` copies `jq -s '<transformed expression>'` for the slurped NDJSON array.
- `copy-state` shows `Copied` on the clicked button for ~2 seconds.
- `copy-fail` shows the manual-copy alert when the clipboard write is denied.

## How to get to it (user POV)

- Build a path (see [build-path-from-clicks](./build-path-from-clicks.md)), then press the `Copy` button beside the expression in the path well.
- For NDJSON input, choose between `Copy per-line` and `Copy slurped` on the same row.

## Driving it with pw-jqp

Preconditions:

- Baseline launch and doctor have passed.
- A selection exists: `fill '#json-input' '{"items":[{"name":"a"},{"name":"b"}]}'`, expand `items` and `[0]`, `clickrow name 0`, so `.path-output` shows `.items[0].name`.

- **Plain copy.** Press the `Copy` button. `node "$HELPER" click 'role=button[name="Copy"]'` - the button relabels `Copied` and gains the `.path-copy-copied` class.
- **Read back.** The reliable read-back stubs `navigator.clipboard` before the click: `node "$HELPER" eval "await page.evaluate(() => { Object.defineProperty(navigator,'clipboard',{value:{writeText:(t)=>{window.__copied=t;return Promise.resolve();}},configurable:true}); }); await page.locator('role=button[name=\"Copy\"]').click(); return await page.evaluate(()=>window.__copied)"` - the printed value is `.items[0].name` exactly (the bare expression, no `jq` prefix).
- **NDJSON buttons.** Fill NDJSON input, then rebuild a selection - loading clears the clicks from the preconditions (every text load calls `setClicks([])`), so no copy buttons exist until a path exists again. `node "$HELPER" fill '#json-input' @fixture.ndjson` (the ten-line fixture from [NDJSON records](./ndjson-records.md), or any file with `{"items":[{"name":"a"}]}` as its first line), expand `items` and `[0]` on record 1, `clickrow name 0` - the record nav appears and the path line shows `Copy per-line` and `Copy slurped` buttons instead of `Copy`.
- **Per-line copy.** `node "$HELPER" click 'role=button[name="Copy per-line"]'` then the same `eval` read-back - clipboard is `jq '.items[0].name'` (quoted invocation).
- **Slurped copy.** `node "$HELPER" click 'role=button[name="Copy slurped"]'` then read back - clipboard is `jq -s '.[].items[0].name'` (the expression re-rooted for the slurped array).
- **State decay.** Wait ~2.5s via `node "$HELPER" eval "await page.waitForTimeout(2500)"` - the button label reverts from `Copied` to its copy verb.
- **Proof.** `node "$HELPER" shot "$EVIDENCE_DIR/copy-copied.png"` while `Copied` is showing, plus the `eval` outputs appended to `proof.txt`.

## Gotchas

- Clipboard read needs permission in the launched profile; Edge headless grants `clipboard-read`/`clipboard-write` on localhost by default in recent versions - if `readText` rejects, use the `window.__copied` stub above, or assert the `Copied` label plus `.path-copy-copied` class as substitute proof.
- A denied clipboard shows `.copy-error[role=alert]` ("Couldn't copy to the clipboard. Select the path above and copy it manually.") - drive it by stubbing `writeText` to `Promise.reject(...)` instead of resolving.
- The `Copied` state is per-button: copying one line does not relabel the other buttons.
- Plain-JSON input has no `Copy per-line`/`Copy slurped` pair; asserting their presence is an NDJSON-only check.
