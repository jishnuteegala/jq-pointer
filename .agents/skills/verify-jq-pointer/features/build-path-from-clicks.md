# Build a path from clicks

Build a path lets a user paste JSON, click a value in the tree to get its jq path, click a sibling to generalise the path over the array, and manage the selection through chips and the iterate-over breadcrumb.

## Sub-features

- `build-tree` renders the interactive tree after a valid document is pasted.
- `build-single` produces the jq path for one clicked value.
- `build-generalise` widens the path to a common pattern when a sibling is clicked.
- `build-chips` removes or clears selected nodes from the chip bar.
- `build-widen` changes which array level the path iterates over via the breadcrumb.
- `build-note` reports heterogeneous matches as `matches N of M elements`.

## How to get to it (user POV)

- Type or paste JSON into the `JSON document` textarea, or drop a file onto it.
- Click a row in the `JSON document tree`, or expand/collapse with the `Expand <label>` / `Collapse <label>` toggle buttons.
- Remove one selection with a `Remove <path>` chip button, or all selections with `Clear`.
- Press a breadcrumb button under `Iterate over:` to widen the iterated array.

## Driving it with pw-jqp

Preconditions:

- Baseline launch and doctor have passed.
- Browser launched via `pw-jqp launch http://localhost:4199/ "$EVIDENCE_DIR"`.

- **Load document.** Fill the textarea. `node "$HELPER" fill '#json-input' '{"items":[{"name":"a"},{"name":"b"}]}'` - a `tree` labelled `JSON document tree` appears with a `$` root row.
- **Expand to the leaf.** Click the `items` toggle. `node "$HELPER" click 'role=button[name="Expand items"]'` then `node "$HELPER" click 'role=button[name="Expand [0]"]'` - `treeitem` rows for `name` and its siblings appear (the `[1]` row may need `Expand items` only once).
- **Single path.** Click the `name` row under `[0]`. `node "$HELPER" clickrow name 0` - `.path-output` prints `.items[0].name` and the chip bar shows a `.items[0].name` chip. No `.match-note` renders: a single click can never match a subset of an array.
- **Generalise.** Expand `[1]` and click its `name` row. `node "$HELPER" click 'role=button[name="Expand [1]"]'` then `node "$HELPER" clickrow name 1` - `.path-output` becomes `.items[].name`, both rows show `aria-selected="true"`, and still no `.match-note` (every element has a `name`, so the match is total). Assert absence with `.locator('.match-note').count()` - reading text from the absent note times out.
- **Heterogeneous note.** The `matches N of M elements` note needs a document where some array elements lack the key, plus clicks on at least two elements. `node "$HELPER" fill '#json-input' '{"items":[{"name":"a"},5,{"name":"c"}]}'`, expand `items`, `[0]`, and `[2]`, then `clickrow name 0` and `clickrow name 1` - `.path-output` becomes `.items[].name?` (optional chaining) and `.match-note` reads `matches 2 of 3 elements`.
- **Widen/iterate.** The `Iterate over:` breadcrumb only appears when the clicked nodes have two or more array ancestors - it never shows on the basic fixture. Drive it with a nested array: `node "$HELPER" fill '#json-input' '{"items":[[{"name":"a"},{"name":"b"}]]}'`, expand `items`, then `Expand [0]` for the inner array, then `Expand [0]` and `Expand [1]` for the two objects, then `clickrow name 0` + `clickrow name 1` - `.path-output` shows `.items[0][].name` and `.breadcrumb` reads `Iterate over:` with `.items[0]` (active) and `.items`. Press `node "$HELPER" click '.breadcrumb-item:text-is(".items")'` - the output widens to `.items[][].name`. The role-name selector `role=button[name=".items"]` collides with the chip `Remove` buttons; use the `.breadcrumb-item` CSS handle.
- **Remove one.** Click `Remove .items[0].name`-style chip buttons or `Clear`. `node "$HELPER" click 'role=button[name="Clear"]'` - the chip bar disappears and `.path-output` returns to the empty prompt `Click a value in the tree to get its jq path, then a sibling to generalise`.
- **Proof.** `node "$HELPER" shot "$EVIDENCE_DIR/build-path.png"`, `node "$HELPER" aria "$EVIDENCE_DIR/build-path.aria.txt"`, and `node "$HELPER" text '.path-output' >> "$EVIDENCE_DIR/proof.txt"` after each state.

## Gotchas

- Clicking an expandable row selects it AND expands it; to expand without selecting, click the `Expand <label>` toggle button instead of the row.
- Clicking the same row twice toggles its selection off - the chip and highlight disappear.
- Select rows with `clickrow <label> [occurrence]`, never `text=` - `getByText` substring-matches placeholder and value text and clicks the wrong element (observed: `text=name` matched nothing selectable and the path stayed empty).
- `role=treeitem[name="..."]` is unreliable for row clicks - the accessible name concatenates label and value text (`name "a"`), so exact name matching needs the full string.
- New input clears all clicks, chips, and the filter; each recipe needs its own document fill.
- The tree is virtualised at 44px rows; a row deep in a large document may need `eval` scrolling of `#tree-view` before its `treeitem` exists in the DOM.
