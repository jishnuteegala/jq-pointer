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
- A fixture file `fixture.ndjson` holds exactly:

```text
{"items":[{"name":"a"}]}
{"items":[{"name":"b"},{"name":"c"}]}
not json {
{"meta":true}
```

- **Detection.** Fill the textarea. `node "$HELPER" fill '#json-input' @fixture.ndjson` - a section labelled `NDJSON records` appears with `Record 1/3 (line 1)` and `Previous record` disabled.
- **Bad-line note.** The `record-error` note shows `Line 3` with an excerpt for the unparsable line.
- **Step forward.** `node "$HELPER" click 'role=button[name="Next record"]'` - the output reads `Record 2/3 (line 2)` and the tree re-renders the second record's `items` (two elements, not one).
- **Step to last.** Click `Next record` again - `Record 3/3 (line 4)`, `Next record` becomes disabled, and the tree shows the `meta` object.
- **Step back.** `node "$HELPER" click 'role=button[name="Previous record"]'` - returns to `Record 2/3 (line 2)` with both nav buttons enabled.
- **Selection reset.** On record 2, build any path (expand `items`, expand `[0]`, `clickrow name 0`), then press `Next record` - chips and `.path-output` clear back to the empty prompt.
- **Whole-JSON exclusion.** Filling `[{"a":1},{"a":2}]` (valid JSON) must NOT show the record nav; the tree renders a two-element array instead.
- **Proof.** `node "$HELPER" text 'section[aria-label="NDJSON records"]' >> "$EVIDENCE_DIR/proof.txt"` after each step, plus `shot`/`aria` artifacts at `Record 2/3`.

## Gotchas

- Detection requires the whole input to be invalid JSON; a JSON array of objects is a plain document, not NDJSON.
- Fewer than ~90% parseable lines falls back to a parse error alert, not the record nav.
- `Record N/M` counts only successfully parsed records, while `line L` is the real line number - they differ when a line fails (as in the fixture).
- The record index resets to 1 on every new fill; recipes must re-navigate after reloading.
