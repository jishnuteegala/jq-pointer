import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { TreeView } from "./components/TreeView";
import { printPath } from "./lib/jq-expression";
import { MAX_DOCUMENT_BYTES, parseDocument, type ParseOutcome } from "./lib/parse-document";
import { buildPathModel, pathTo, type ModelNode, type PathModel } from "./lib/path-model";

function describeOutcome(outcome: ParseOutcome): string {
  if (outcome.kind === "too-large") {
    const megabytes = (outcome.bytes / 1024 / 1024).toFixed(1);
    const limit = (outcome.limit / 1024 / 1024).toFixed(0);
    return `Document is ${megabytes}MB; the cap is ~${limit}MB.`;
  }
  if (outcome.kind === "error") return outcome.message;
  return "";
}

const DISPLAY_LIMIT = 256 * 1024;

function displayText(value: string): string {
  if (value.length <= DISPLAY_LIMIT) return value;
  const megabytes = (value.length / 1024 / 1024).toFixed(1);
  return `[${megabytes}MB document loaded - too large to display]`;
}

function App() {
  const [text, setText] = useState("");
  const [version, setVersion] = useState(0);
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [selected, setSelected] = useState<ModelNode | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const loadGeneration = useRef(0);

  const model: PathModel | null = useMemo(() => {
    if (outcome === null || outcome.kind !== "ok") return null;
    return buildPathModel(outcome.value);
  }, [outcome]);

  const path = useMemo(() => {
    if (selected === null) return null;
    const result = pathTo(selected);
    return result.kind === "path" ? printPath(result.segments) : null;
  }, [selected]);

  const highlighted = useMemo(() => new Set(selected === null ? [] : [selected]), [selected]);

  const loadText = (value: string) => {
    loadGeneration.current += 1;
    setText(displayText(value));
    setVersion((previous) => previous + 1);
    setSelected(null);
    setCopied(false);
    setCopyFailed(false);
    setOutcome(value.trim() === "" ? null : parseDocument(value));
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    loadText(event.target.value);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text/plain");
    if (pasted.length > DISPLAY_LIMIT) {
      event.preventDefault();
      loadText(pasted);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        loadGeneration.current += 1;
        setText("");
        setVersion((previous) => previous + 1);
        setSelected(null);
        setCopied(false);
        setOutcome({ kind: "too-large", bytes: file.size, limit: MAX_DOCUMENT_BYTES });
        return;
      }
      const generation = (loadGeneration.current += 1);
      const contents = await file.text();
      if (generation !== loadGeneration.current) return;
      loadText(contents);
      return;
    }
    const dropped = event.dataTransfer.getData("text/plain");
    if (dropped !== "") loadText(dropped);
  };

  const handleCopy = async () => {
    if (path === null) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const handleSelect = (node: ModelNode) => {
    setSelected(node);
    setCopied(false);
    setCopyFailed(false);
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main id="main-content">
        <h1>jq-pointer</h1>
        <p>Paste or drop JSON, click the value you want, get the jq expression that extracts it.</p>
        <label className="input-label" htmlFor="json-input">
          JSON document
        </label>
        <textarea
          id="json-input"
          className="json-input"
          value={text}
          onChange={handleChange}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(event: DragEvent<HTMLTextAreaElement>) => event.preventDefault()}
          placeholder="Paste JSON here or drop a file onto this box"
          spellCheck={false}
        />
        {outcome !== null && outcome.kind !== "ok" && (
          <div className="parse-error" role="alert">
            <p>{describeOutcome(outcome)}</p>
            {outcome.kind === "error" && <pre>{outcome.excerpt}</pre>}
          </div>
        )}
        {model !== null && (
          <>
            <div className="path-bar">
              <output className="path-output" aria-live="polite">
                {path ?? "Click a value in the tree to get its jq path"}
              </output>
              <button
                type="button"
                className="copy-button"
                onClick={handleCopy}
                disabled={path === null}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {copyFailed && (
              <p className="copy-error" role="alert">
                Couldn&apos;t copy to the clipboard. Select the path above and copy it manually.
              </p>
            )}
            <TreeView
              key={version}
              root={model.root}
              highlighted={highlighted}
              onSelect={handleSelect}
            />
          </>
        )}
      </main>
    </>
  );
}

export default App;
