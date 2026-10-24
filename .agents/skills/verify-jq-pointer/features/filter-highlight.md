# Filter highlighting

Filter highlighting lets a user paste a jq expression into the highlight box and see matching tree nodes light up, with a status line reporting what happened.

## Sub-features

- `filter-match` highlights rows matching the expression and reports `Highlighting N matching nodes.`
- `filter-empty` reports `No nodes match this filter.` for a valid expression with no hits.
- `filter-unsupported` reports `Can't preview this filter.` for expression forms the previewer cannot evaluate.
- `filter-runtime` reports `This filter errors on this document, so there is nothing to highlight.`
- `filter-clear` removes the highlight when the input empties.

## How to get to it (user POV)

- Load a document (see [build-path-from-clicks](./build-path-from-clicks.md)), then type into the `Highlight nodes matching a jq expression` input below the path bar.
- Clear the input to remove highlighting.

## Driving it with pw-jqp

Preconditions:

- Baseline launch and doctor have passed.
- Document loaded: `fill '#json-input' '{"items":[{"name":"a"},{"name":"b"}],"meta":{"version":1}}'` with `items` expanded so both `name` rows are visible.

- **Match.** Fill the filter. `node "$HELPER" fill '#filter-input' '.items[].name'` - `#filter-status` reads `Highlighting 2 matching nodes.` and the two `name` rows show `tree-row-highlighted` / `aria-selected="true"`.
- **Empty match.** `node "$HELPER" fill '#filter-input' '.items[].missing'` - status reads `No nodes match this filter.` and no row is highlighted.
- **Unsupported.** `node "$HELPER" fill '#filter-input' '.items[] | length'` (or another form the previewer cannot preview) - status reads `Can't preview this filter.` and `#filter-input` gains `aria-invalid="true"`.
- **Runtime error.** `node "$HELPER" fill '#filter-input' '.items[].name[0]'` on this fixture (indexing a string behaves differently per input; pick an expression that throws on the loaded document) - status reads `This filter errors on this document, so there is nothing to highlight.`
- **Clear.** `node "$HELPER" fill '#filter-input' ''` - the status line empties and all highlighting is removed.
- **Proof.** `node "$HELPER" shot "$EVIDENCE_DIR/filter-match.png"` in the matched state, `node "$HELPER" text '#filter-status' >> "$EVIDENCE_DIR/proof.txt"` for each status.

## Gotchas

- The exclusivity is one-directional: clicking a row clears the filter, but typing a filter does NOT clear click selections - chips and `.path-output` survive (only the click-driven row highlight is visually suppressed while the filter matches render); clearing the filter restores the click highlight. Drive them in separate fills anyway to keep assertions unambiguous.
- The status line lives in `#filter-status` and is `aria-live`; assert its text, not row colours alone.
- Only an unsupported filter sets `aria-invalid="true"` on the input (plus a `filter-status-unsupported` class on the status); a runtime-error filter reports its message with `aria-invalid="false"`. Clearing the input removes the flag.
- Highlighted ancestors auto-expand - a deep match may reveal rows without manual expansion.
