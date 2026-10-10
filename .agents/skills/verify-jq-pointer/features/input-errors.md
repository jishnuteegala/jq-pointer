# Input errors

Input errors tells the user when pasted text cannot be used: invalid JSON gets an alert with an excerpt, oversized input gets the ~10MB cap message, and empty input shows nothing at all.

## Sub-features

- `input-parse` shows a `role=alert` error with a parse message and excerpt for invalid JSON.
- `input-too-large` reports `Document is Xmb; the cap is ~10MB.` for input over the byte limit.
- `input-empty` shows no error and no tree before the user types.
- `input-replace` replaces an old document and clears error state on new input.

## How to get to it (user POV)

- Type or paste invalid JSON into the `JSON document` textarea.
- Drop or paste a document larger than the ~10MB cap.

## Driving it with pw-jqp

Preconditions:

- Baseline launch and doctor have passed.

- **Empty state.** Right after `launch`, `.path-output`, `#parse-error`, and `.tree-view` are absent - only the heading, intro, textarea, filter input (hidden until a document loads), and footer exist. `node "$HELPER" aria "$EVIDENCE_DIR/empty.aria.txt"` captures this.
- **Invalid JSON.** `node "$HELPER" fill '#json-input' '{"items": [}'` - `#parse-error` with `role=alert` appears containing a parse message and an excerpt `<pre>`; `#json-input` gets `aria-invalid="true"`.
- **Recovery.** `node "$HELPER" fill '#json-input' '{"ok":true}'` - the alert disappears and the tree renders.
- **Too large.** Generate an oversized document, e.g. `node -e "console.log('{\"pad\":\"' + 'x'.repeat(11*1024*1024) + '\"}')" > "$PW_DIR/big.json"`, then `node "$HELPER" fill '#json-input' @"$PW_DIR/big.json"` - `#parse-error` reads `Document is <mb>MB; the cap is ~10MB.`
- **Proof.** `node "$HELPER" shot "$EVIDENCE_DIR/parse-error.png"` while the alert shows, plus `node "$HELPER" text '#parse-error' >> "$EVIDENCE_DIR/proof.txt"`.

## Gotchas

- The cap is on bytes, not characters - multibyte input hits it sooner than the character count suggests.
- Paste of a large document is intercepted (`handlePaste`); `fill` bypasses the paste path but lands in the same `loadText` route, so the same cap and display rules apply.
- `too-large` via file drop short-circuits before display (`handleDrop` reads `file.size` first); simulating a real drop in the driver is not wired - the fill route proves the alert path, not the drop path; record that distinction in the run notes.
- An `aria-live` empty `filter-status` element exists only after a document loads; asserting it pre-load is a false failure.
