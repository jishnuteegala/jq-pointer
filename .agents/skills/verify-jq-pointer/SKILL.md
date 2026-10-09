---
name: verify-jq-pointer
description: "Drive jq-pointer the way a user does - paste JSON into the web UI, click the tree, copy the jq path - and capture proof. Use whenever a change to this repo needs runtime verification beyond pnpm check (UI copy, behaviour, released surfaces)."
---

# Verify jq-pointer

jq-pointer is a single-page web app (Vite + React + TypeScript, all client-side).
The primary surface is the SPA at `/`; secondary released surfaces are `/design-system/` and `/llms.txt`.
This skill launches the app locally, drives it with playwright-core against the system Edge browser (no browser download, no repo dependency), and captures screenshots and accessibility-tree dumps as evidence.

The feature map in `features/` is the maintained source of what to prove.
Read `features/README.md` before driving anything.

## Launch

The app is a static SPA; a local HTTP server is the instance.
Two equivalent launch paths - prefer the first.

Dev server (fast, includes the `/llms.txt` middleware):

```bash
cd <repo-root>
nohup pnpm run dev --port 4199 --strictPort > "$EVIDENCE_DIR/dev-server.log" 2>&1 &
echo $! > "$EVIDENCE_DIR/dev-server.pid"
```

Built bundle (what actually ships; run `pnpm run build` first):

```bash
cd <repo-root>
nohup pnpm run preview --port 4199 --strictPort > "$EVIDENCE_DIR/preview.log" 2>&1 &
echo $! > "$EVIDENCE_DIR/preview.pid"
```

Ready check: `curl -fsS http://localhost:4199/` returns HTML containing `<title>jq-pointer</title>` within ~5s.
Two runs can coexist by picking different ports (`--strictPort` makes a collision fail loudly instead of silently serving a different app). Vite binds `localhost` (IPv6 `::1` on Windows); add `--host 127.0.0.1` to the launch command if your driver or curl prefers a literal IPv4.
Never drive a server you did not start - if `curl` answers before you launch, something else owns the port; pick another.

## Doctor

One read-only check that answers "is this instance worth driving?" Run it first whenever anything looks off.

```bash
curl -fsS http://localhost:4199/ | grep -q '<title>jq-pointer</title>' \
  && curl -fsS http://localhost:4199/llms.txt | head -1 \
  && echo "DOCTOR OK: jq-pointer serving on 4199"
```

Pass criteria: the title matches and `/llms.txt` responds with `# jq-pointer` as its first line (dev middleware and `dist/llms.txt` both satisfy this).
Also confirm the PID in `"$EVIDENCE_DIR"/*.pid` is still alive (`kill -0 <pid>`) - a page that answers without your server running means a foreign instance on the port; stop and relaunch on a different port.

## Drive

Harness: `helpers/drive.mjs` (invoked as `pw-jqp`), playwright-core over CDP against system Edge.
Bootstrap once per verification run (playwright-core is a scratch dependency, never a repo one):

```bash
PW_DIR="$(mktemp -d)" && cd "$PW_DIR" && pnpm init && pnpm add playwright-core@1.64.0
HELPER="$(cygpath -m "<repo-root>/.agents/skills/verify-jq-pointer/helpers/drive.mjs")"
EVIDENCE_DIR="$PW_DIR/evidence" && mkdir -p "$EVIDENCE_DIR"
```

Then, with the app launched and doctored:

```bash
cd "$PW_DIR"   # drive.mjs resolves playwright-core from the cwd package
node "$HELPER" launch http://localhost:4199/ "$EVIDENCE_DIR"
node "$HELPER" fill '#json-input' '{"items":[{"name":"a"},{"name":"b"}]}'
node "$HELPER" click 'role=button[name="Expand items"]'
node "$HELPER" click 'role=button[name="Expand [0]"]'
node "$HELPER" clickrow name                # selects the leaf row under items[0]
node "$HELPER" text '.path-output'          # prints the built jq path + controls
node "$HELPER" shot "$EVIDENCE_DIR/path-built.png"
node "$HELPER" aria "$EVIDENCE_DIR/tree.aria.txt"
node "$HELPER" stop
```

`launch` starts a detached keeper process (a headless Edge with a temp profile and CDP on `127.0.0.1:9223`) and writes `pw-state.json` into the working directory (`$PW_DIR`), never into the repo.
Every later command connects over CDP, acts, and disconnects.
Selectors accept a CSS selector, `text=`, `role=<role>[name="..."]`, or `@file` for `fill` values.
`eval '<js>'` runs an async body with `page` in scope for anything the primitives miss (clipboard reads need `eval "await page.context().browser().contexts()[0]"`-level access - prefer asserting the `Copied` label state instead).

Stable handles (from `src/`): `#json-input`, `#filter-input`, `#filter-status`, `#tree-view` (role `tree`), `.tree-row` (role `treeitem`, `aria-selected`; select one with `clickrow <label>` - plain `text=` matches collide with row text and placeholders), `.tree-toggle` (`Expand|Collapse <label>`), `.path-output`, `.path-expression`, `.path-copy` (`Copy`/`Copy per-line`/`Copy slurped`/`Copied`), `.chip-bar` (`Remove <path>`, `Clear`), `.breadcrumb` (`Widen the iterated array`), `.record-nav` (`NDJSON records`, `Previous record`/`Next record`), `.match-note`, `#parse-error` (role `alert`), footer `Privacy`/`Source` links.

## Evidence

Each run names one evidence dir: `"$PW_DIR/evidence"` (inside the scratch bootstrap dir) or `$(mktemp -d)/evidence` if bootstrapping differently.
State it at the start of the run and print it at the end.

Proof standard per feature file: capture the user action and the resulting state, not just the final screen.
A passing feature produces at minimum: one `.png` screenshot with the app identity visible, one `.aria.txt` accessibility dump, and a `proof.txt` recording the observed strings (path text, button labels, note text) that assert the behaviour.
Mutation/clipboard claims need the read-back (`eval` reading `navigator.clipboard` after granting permission) or the `Copied` label state plus the `.path-copy-copied` class; a screenshot of the button alone is not proof of clipboard content.
Evidence never lives in the repo and never under a path the cleanup step removes.

## Cleanup

```bash
cd "$PW_DIR"
node "$HELPER" stop                              # closes Edge + the keeper
kill "$(cat "$EVIDENCE_DIR/dev-server.pid")"     # or preview.pid; PID you started, never by name
```

Then confirm the evidence survived: `ls "$EVIDENCE_DIR"` must still show the `.png`, `.aria.txt`, and `proof.txt` artifacts (`pw-state.json` stays at `$PW_DIR`, not in evidence).
If any are missing, cleanup ate the proof - that is a failure of the run, not a detail.
Kill by recorded PID only; on Windows `powershell.exe -NoProfile -Command "Stop-Process -Id <pid>"` is the fallback.
The scratch `PW_DIR` itself is disposable after evidence is copied wherever the caller wants it kept.

## Helpers

`helpers/drive.mjs` - the `pw-jqp` control script.
No repo dependencies; it loads `playwright-core` from the caller's cwd via `createRequire`, so it must run from the bootstrap dir (`cd "$PW_DIR"`).
Commands: `launch <url> <evidence-dir>`, `stop`, `click <selector>`, `clickrow <label> [occurrence]` (click a `.tree-row` by its exact `.tree-label` text - the reliable handle for selecting nodes), `fill <selector> <value|@file>`, `press <key>`, `text <selector>`, `shot <file.png>`, `aria <file.txt>`, `eval <js-body>`, `open <path>` (navigate a new tab).
It exits non-zero with the failing selector/action on stderr when a step cannot complete, so a broken drive leaves readable state.
