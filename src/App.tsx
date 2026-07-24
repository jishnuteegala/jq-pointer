import { useState } from "react";
import { TreeView } from "./components/TreeView";
import { parseJsonInput } from "./lib/json-input";
import { printPath } from "./lib/jq-expression";
import { buildPathModel, pathTo, type ModelNode } from "./lib/path-model";

function App() {
  const [root, setRoot] = useState<ModelNode | null>(null);
  const [selected, setSelected] = useState<ModelNode | null>(null);
  const [expression, setExpression] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(source: string) {
    const result = parseJsonInput(source);
    if (result.kind === "error") return setError(result.message);
    setRoot(buildPathModel(result.value).root);
    setSelected(null);
    setExpression(null);
    setError(null);
  }

  function select(node: ModelNode) {
    const result = pathTo(node);
    if (result.kind === "unsupported") return setError("This path contains a key jq cannot represent.");
    setSelected(node);
    setExpression(printPath(result.segments));
    setError(null);
  }

  async function copy() {
    if (expression !== null) await navigator.clipboard.writeText(expression);
  }

  return (
    <main className="app-shell">
      <h1>jq-pointer</h1>
      <p>Paste JSON, click the value you want, get the jq expression that extracts it.</p>
      <label className="input-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files.item(0);
        if (file !== null) void file.text().then(load);
      }}>JSON input (paste or drop a file)
        <textarea onChange={(event) => load(event.target.value)} placeholder='{"items": ["click me"]}' />
      </label>
      {error !== null && <p className="error" role="alert">{error}</p>}
      {expression !== null && <section aria-live="polite" className="expression-panel"><code>{expression}</code><button onClick={() => void copy()} type="button">Copy</button></section>}
      {root !== null && <TreeView onSelect={select} root={root} selected={selected} />}
    </main>
  );
}

export default App;
