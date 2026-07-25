import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { TreeView } from "./components/TreeView";
import { printPath } from "./lib/jq-expression";
import { MAX_DOCUMENT_BYTES, parseDocument, type ParseOutcome } from "./lib/parse-document";
import { buildPathModel, pathTo, type ModelNode, type PathModel } from "./lib/path-model";
import { reverseHighlight, type ReverseHighlight } from "./lib/reverse-highlight";

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
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const loadGeneration = useRef(0);
  const copyGeneration = useRef(0);

  const model: PathModel | null = useMemo(() => {
    if (outcome === null || outcome.kind !== "ok") return null;
    return buildPathModel(outcome.value);
  }, [outcome]);

  const path = useMemo(() => {
    if (selected === null) return null;
    const result = pathTo(selected);
    return result.kind === "path" ? printPath(result.segments) : null;
  }, [selected]);

  const unsupported = useMemo(() => {
    if (selected === null) return false;
    return pathTo(selected).kind === "unsupported";
  }, [selected]);

  const preview: ReverseHighlight = useMemo(() => {
    if (model === null) return { kind: "empty" };
    return reverseHighlight(model.root, filter);
  }, [model, filter]);

  const highlighted = useMemo(() => {
    if (preview.kind === "match") return new Set(preview.nodes);
    return new Set(selected === null ? [] : [selected]);
  }, [preview, selected]);

  const loadText = (value: string) => {
    loadGeneration.current += 1;
    setText(displayText(value));
    setVersion((previous) => previous + 1);
    setSelected(null);
    setFilter("");
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
    const generation = (copyGeneration.current += 1);
    try {
      await navigator.clipboard.writeText(path);
      if (generation !== copyGeneration.current) return;
      setCopied(true);
      setCopyFailed(false);
    } catch {
      if (generation !== copyGeneration.current) return;
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const handleSelect = (node: ModelNode) => {
    copyGeneration.current += 1;
    setSelected(node);
    setFilter("");
    setCopied(false);
    setCopyFailed(false);
  };

  const filterStatus = (): string => {
    if (preview.kind === "unsupported") return "Can't preview this filter.";
    if (preview.kind === "runtime-error")
      return "This filter errors on this document, so there is nothing to highlight.";
    if (preview.kind === "match") {
      if (preview.nodes.length === 0) return "No nodes match this filter.";
      if (preview.nodes.length === 1) return "Highlighting 1 matching node.";
      return `Highlighting ${preview.nodes.length} matching nodes.`;
    }
    return "";
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
              <output
                className={`path-output${unsupported ? " path-output-unsupported" : ""}`}
                aria-live="polite"
              >
                {unsupported
                  ? "This key can't be expressed as a jq path (lone surrogate in the key)."
                  : (path ?? "Click a value in the tree to get its jq path")}
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
            <label className="input-label" htmlFor="filter-input">
              Highlight nodes matching a jq expression
            </label>
            <input
              id="filter-input"
              className="filter-input"
              type="text"
              value={filter}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value)}
              placeholder="Paste a jq expression, e.g. .items[].name"
              spellCheck={false}
              aria-invalid={preview.kind === "unsupported"}
              aria-describedby="filter-status"
            />
            <p
              id="filter-status"
              className={`filter-status${
                preview.kind === "unsupported" || preview.kind === "runtime-error"
                  ? " filter-status-unsupported"
                  : ""
              }`}
              aria-live="polite"
            >
              {filterStatus()}
            </p>
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
