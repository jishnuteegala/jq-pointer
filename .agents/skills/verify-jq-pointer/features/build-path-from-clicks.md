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
- **Single path.** Click the `name` row under `[0]`. `node "$HELPER" clickrow name 0` - `.path-output` prints `.items[0].name`, the chip bar shows a `.items[0].name` chip, and `.match-note` reads `matches 1 of 2 elements`.
- **Generalise.** Expand `[1]` and click its `name` row. `node "$HELPER" click 'role=button[name="Expand [1]"]'` then `node "$HELPER" clickrow name 1` - `.path-output` becomes `.items[].name`, both rows show `aria-selected="true"`, and `.match-note` disappears (the `matches N of M` note only renders for heterogeneous, subset matches).
- **Widen/iterate.** The breadcrumb `Iterate over:` appears when ancestors allow it; pressing `.items` changes the iterated level - the `.breadcrumb-item-active` button moves.
- **Remove one.** Click `Remove .items[0].name`-style chip buttons or `Clear`. `node "$HELPER" click 'role=button[name="Clear"]'` - the chip bar disappears and `.path-output` returns to the empty prompt `Click a value in the tree to get its jq path, then a sibling to generalise`.
- **Proof.** `node "$HELPER" shot "$EVIDENCE_DIR/build-path.png"`, `node "$HELPER" aria "$EVIDENCE_DIR/build-path.aria.txt"`, and `node "$HELPER" text '.path-output' >> "$EVIDENCE_DIR/proof.txt"` after each state.

## Gotchas

- Clicking an expandable row selects it AND expands it; to expand without selecting, click the `Expand <label>` toggle button instead of the row.
- Clicking the same row twice toggles its selection off - the chip and highlight disappear.
- Select rows with `clickrow <label> [occurrence]`, never `text=` - `getByText` substring-matches placeholder and value text and clicks the wrong element (observed: `text=name` matched nothing selectable and the path stayed empty).
- `role=treeitem[name="..."]` is unreliable for row clicks - the accessible name concatenates label and value text (`name "a"`), so exact name matching needs the full string.
- New input clears all clicks, chips, and the filter; each recipe needs its own document fill.
- The tree is virtualised at 44px rows; a row deep in a large document may need `eval` scrolling of `#tree-view` before its `treeitem` exists in the DOM.
