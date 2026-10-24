# NDJSON records

NDJSON records lets a user paste multi-line JSON, see it recognised as NDJSON, and step through each record with Previous/Next while the tree and paths track the current record.

## Sub-features

- `ndjson-detect` recognises at least two non-empty lines, ~90% parseable, that are not valid JSON as a whole.
- `ndjson-nav` shows `Record N/M (line L)` and steps between records.
- `ndjson-errors` reports `Line L` notes for lines that failed to parse.
- `ndjson-selection` clears clicks and resets the path when the record changes.

## How to get to it (user POV)

- Paste NDJSON (one JSON value per line) into the `JSON document` textarea.
- Press `Previous record` / `Next record` in the `NDJSON records` section to move between records.

## Driving it with pw-jqp

Preconditions:

- Baseline launch and doctor have passed.
- A fixture file `fixture.ndjson` holds exactly ten non-empty lines, nine parseable - the detection threshold is `records / non-empty lines >= 0.9` (inclusive), so a shorter error-note fixture cannot pass:

```text
{"items":[{"name":"a"}]}
{"items":[{"name":"b"},{"name":"c"}]}
not json {
{"meta":true}
{"v":5}
{"v":6}
{"v":7}
{"v":8}
{"v":9}
{"v":10}
```

- **Detection.** Fill the textarea. `node "$HELPER" fill '#json-input' @fixture.ndjson` - a `.record-nav` section labelled `NDJSON records` appears with `Record 1/9 (line 1)` and `Previous record` disabled.
- **Bad-line note.** The `record-error` note shows `Line 3` with a caret excerpt for the unparsable line.
- **Step forward.** `node "$HELPER" click 'role=button[name="Next record"]'` - the output reads `Record 2/9 (line 2)` and the tree re-renders the second record's `items` (two elements, not one).
- **Line vs record index.** Click `Next record` again - `Record 3/9 (line 4)`: the line number skips the failed line 3 while the record index counts only parsed records.
- **Step back.** `node "$HELPER" click 'role=button[name="Previous record"]'` - returns to `Record 2/9 (line 2)` with both nav buttons enabled.
- **Selection reset.** On any record, build a path (on record 3 click `meta`; on record 2 expand `items`, expand `[0]`, `clickrow name 0`), then press `Next record` - chips and `.path-output` clear back to the empty prompt.
- **Whole-JSON exclusion.** Filling `[{"a":1},{"a":2}]` (valid JSON) must NOT show the record nav; the tree renders a two-element array instead.
- **Proof.** `node "$HELPER" text 'section[aria-label="NDJSON records"]' >> "$EVIDENCE_DIR/proof.txt"` after each step, plus `shot`/`aria` artifacts at `Record 2/9`.

## Gotchas

- Detection requires the whole input to be invalid JSON; a JSON array of objects is a plain document, not NDJSON.
- Strictly under 90% parseable non-empty lines falls back to a parse error alert, not the record nav (9/10 = 0.9 passes, 8/10 = 0.8 fails). Fewer than two parseable records also fails regardless of ratio.
- `Record N/M` counts only successfully parsed records, while `line L` is the real line number - they differ when a line fails (as in the fixture).
- The record index resets to 1 on every new fill; recipes must re-navigate after reloading.
