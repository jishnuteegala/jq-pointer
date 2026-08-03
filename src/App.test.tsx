// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(cleanup);

function row(label: string): HTMLElement {
  const labels = screen.getAllByText(label);
  const found = labels.find((element) => element.closest('[role="treeitem"]') !== null);
  const item = found?.closest('[role="treeitem"]');
  if (item === null || item === undefined) throw new Error(`no tree row for ${label}`);
  return item as HTMLElement;
}

function expressionLine(expression: string): HTMLElement {
  const output = screen
    .getAllByText(expression)
    .find((element) => element.className === "path-expression");
  const line = output?.closest(".path-line");
  if (line === null || line === undefined) throw new Error(`no output line for ${expression}`);
  return line as HTMLElement;
}

function fakeFile(
  size: number,
  contents: string,
  resolveWith?: (release: () => void) => void,
): File {
  return {
    size,
    text: () =>
      new Promise<string>((resolve) => {
        if (resolveWith === undefined) resolve(contents);
        else resolveWith(() => resolve(contents));
      }),
  } as unknown as File;
}

function dropFile(target: HTMLElement, file: File): void {
  fireEvent.drop(target, { dataTransfer: { files: [file], getData: () => "" } });
}

describe("App end-to-end", () => {
  it("pastes JSON, clicks a scalar array element, and copies the indexed path", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);

    const input = screen.getByLabelText("JSON document");
    await user.click(input);
    await user.paste('{"arr": [10, 20, 30]}');

    await user.click(within(row("arr")).getByRole("button", { name: /^Expand / }));
    const first = within(row("[0]")).getByText("[0]");
    await user.click(first);

    expect(expressionLine(".arr[0]")).toBeDefined();
    expect(row("[0]").getAttribute("aria-selected")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(".arr[0]");
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
  });

  it("generalises a click pair to the iterator expression with a heterogeneity note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, 5, {"name": "c"}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[2]")).getByRole("button", { name: /^Expand / }));
    const nameRows = screen.getAllByText("name");
    await user.click(nameRows[0]);
    await user.click(nameRows[nameRows.length - 1]);

    expect(screen.getByText(".items[].name?")).toBeDefined();
    expect(screen.getByText("matches 2 of 3 elements")).toBeDefined();
  });

  it("generalises after expanding the second element without evicting the first click", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, {"name": "b"}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(screen.getAllByText("name")[0]);
    await user.click(within(row("[1]")).getByRole("button", { name: /^Expand / }));
    const names = screen.getAllByText("name");
    await user.click(names[names.length - 1]);

    expect(screen.getByText(".items[].name")).toBeDefined();
  });

  it("shows separate, independently round-trippable outputs for no common pattern", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": [1], "b": [2]}');

    await user.click(within(row("a")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("b")).getByRole("button", { name: /^Expand / }));
    const zeros = screen.getAllByText("[0]");
    await user.click(zeros[0]);
    await user.click(zeros[zeros.length - 1]);

    expect(screen.getByText(/No common pattern/)).toBeDefined();
    expect(expressionLine(".a[0]")).toBeDefined();
    expect(expressionLine(".b[0]")).toBeDefined();

    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    for (const expression of [".a[0]", ".b[0]"]) {
      await user.clear(filter);
      await user.paste(expression);
      expect(screen.getByText("Highlighting 1 matching node.")).toBeDefined();
    }

    await user.click(screen.getAllByRole("button", { name: "Copy" })[0]);
    expect(writeText).toHaveBeenCalledWith(".a[0]");
  });

  it("builds flat shorthand construction from two keys in one element", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a", "id": 1}, {"name": "b", "id": 2}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("name")).getByText("name"));
    await user.click(within(row("id")).getByText("id"));

    expect(expressionLine(".items[] | {name, id}")).toBeDefined();
  });

  it("highlights construction source keys across every matching element", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a", "id": 1}, {"name": "b", "id": 2}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[1]")).getByRole("button", { name: /^Expand / }));
    const names = screen.getAllByText("name");
    await user.click(names[0]);
    await user.click(screen.getAllByText("id")[0]);

    const highlightedRows = [...screen.getAllByText("name"), ...screen.getAllByText("id")].map(
      (label) => label.closest('[role="treeitem"]') as HTMLElement,
    );
    expect(highlightedRows).toHaveLength(4);
    for (const item of highlightedRows) expect(item.getAttribute("aria-selected")).toBe("true");
  });

  it("quotes non-identifier construction keys via shorthand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"a-b": 1, "2fa": 2}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("a-b")).getByText("a-b"));
    await user.click(within(row("2fa")).getByText("2fa"));

    expect(expressionLine('.items[] | {"a-b", "2fa"}')).toBeDefined();
  });

  it("removes a chip and re-resolves the output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a", "id": 1}, {"name": "b", "id": 2}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("name")).getByText("name"));
    await user.click(within(row("id")).getByText("id"));
    expect(expressionLine(".items[] | {name, id}")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Remove .items\[0\].id/ }));
    expect(expressionLine(".items[0].name")).toBeDefined();
  });

  it("clears every chip with the Clear button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, {"name": "b"}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(screen.getAllByText("name")[0]);
    expect(screen.getByRole("group", { name: "Selected nodes" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("group", { name: "Selected nodes" })).toBeNull();
  });

  it("moves focus to the tree when the final chip is removed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, {"name": "b"}]}');

    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(screen.getAllByText("name")[0]);
    await user.click(screen.getByRole("button", { name: /Remove / }));

    expect(screen.queryByRole("group", { name: "Selected nodes" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("tree"));
  });

  it("widens the iterated array through the breadcrumb", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"data": [{"items": [{"name": "a"}, {"name": "b"}]}]}');

    await user.click(within(row("data")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("items")).getByRole("button", { name: /^Expand / }));
    const inner = screen.getAllByText("[0]");
    await user.click(
      within(inner[inner.length - 1].closest('[role="treeitem"]') as HTMLElement).getByRole(
        "button",
        { name: /^Expand / },
      ),
    );
    const oneRows = screen.getAllByText("[1]");
    await user.click(
      within(oneRows[oneRows.length - 1].closest('[role="treeitem"]') as HTMLElement).getByRole(
        "button",
        { name: /^Expand / },
      ),
    );
    const names = screen.getAllByText("name");
    await user.click(names[0]);
    await user.click(names[names.length - 1]);

    expect(expressionLine(".data[0].items[].name")).toBeDefined();

    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.type(filter, ".data[0].items[0].name");
    await user.click(screen.getByRole("button", { name: ".data" }));
    expect(expressionLine(".data[].items[].name")).toBeDefined();
    expect((filter as HTMLInputElement).value).toBe("");
  });

  it("expands the highlighted set when widening to an outer array with more elements", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste(
      '{"data": [{"items": [{"name": "a"}, {"name": "b"}]}, {"items": [{"name": "c"}]}]}',
    );

    await user.click(within(row("data")).getByRole("button", { name: /^Expand / }));
    let toggles = screen.getAllByRole("button", { name: /^Expand / });
    while (toggles.length > 0) {
      await user.click(toggles[0]);
      toggles = screen.queryAllByRole("button", { name: /^Expand / });
    }

    const names = screen.getAllByText("name");
    expect(names).toHaveLength(3);
    await user.click(names[0]);
    await user.click(names[1]);
    expect(expressionLine(".data[0].items[].name")).toBeDefined();
    const selectedBefore = names.filter(
      (label) =>
        (label.closest('[role="treeitem"]') as HTMLElement).getAttribute("aria-selected") ===
        "true",
    );
    expect(selectedBefore).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: ".data" }));
    expect(expressionLine(".data[].items[].name")).toBeDefined();
    for (const label of screen.getAllByText("name")) {
      expect(
        (label.closest('[role="treeitem"]') as HTMLElement).getAttribute("aria-selected"),
      ).toBe("true");
    }
  });

  it("keeps three clicks across different arrays as separate outputs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": [1], "b": [2], "c": [3]}');

    await user.click(within(row("a")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("b")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("c")).getByRole("button", { name: /^Expand / }));
    const zeros = screen.getAllByText("[0]");
    await user.click(zeros[0]);
    await user.click(zeros[1]);
    await user.click(zeros[2]);

    expect(screen.getByText(/No common pattern/)).toBeDefined();
    for (const expression of [".a[0]", ".b[0]", ".c[0]"])
      expect(expressionLine(expression)).toBeDefined();
  });

  it("surfaces a clipboard failure without crashing", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);

    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"arr": [1]}');
    await user.click(within(row("arr")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByText("[0]"));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByText(/Couldn.t copy/)).toBeDefined();
  });

  it("renders a tree from a dropped JSON file", async () => {
    render(<App />);
    const input = screen.getByLabelText("JSON document");
    dropFile(input, fakeFile(20, '{"arr": [7]}'));
    await waitFor(() => expect(row("arr")).toBeDefined());
  });

  it("rejects an oversized dropped file with the cap message", () => {
    render(<App />);
    const input = screen.getByLabelText("JSON document");
    dropFile(input, fakeFile(11 * 1024 * 1024, "unused"));
    expect(screen.getByRole("alert").textContent).toMatch(/cap is/);
  });

  it("shows an explicit unsupported state for a lone-surrogate key", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"\\ud800": 1}');
    await user.click(within(row("\ud800")).getByText("\ud800"));
    expect(screen.getByText(/can't be expressed as a jq path/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("keeps representable outputs when one selected key is a lone surrogate", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"\\ud800": 1, "id": 2}');
    await user.click(within(row("\ud800")).getByText("\ud800"));
    await user.click(within(row("id")).getByText("id"));
    const lines = screen.getAllByText(".id").filter((el) => el.className === "path-expression");
    expect(lines).toHaveLength(1);
    expect(screen.getByText(/lone surrogate/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
  });

  it("shows both notices when unrelated selections include a lone-surrogate key", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"\\ud800": 1, "a": [1], "b": [2]}');
    await user.click(within(row("\ud800")).getByText("\ud800"));
    await user.click(within(row("a")).getByText("a"));
    await user.click(within(row("b")).getByText("b"));
    expect(screen.getByText(/No common pattern.*lone surrogate/)).toBeDefined();
    expect(expressionLine(".a")).toBeDefined();
    expect(expressionLine(".b")).toBeDefined();
  });

  it("shows a positioned parse error with a caret excerpt", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1,\n  "b": oops}');
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/line \d+, column \d+/);
    expect(within(alert).getByText(/\^/)).toBeDefined();
  });

  it("marks the textarea invalid and associates it with the parse error", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("JSON document");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    await user.click(input);
    await user.paste("{oops}");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("parse-error");
    expect(screen.getByRole("alert").id).toBe("parse-error");
  });

  it("shows a positioned error after clearing to whitespace, but none initially", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole("alert")).toBeNull();
    const input = screen.getByLabelText("JSON document");
    await user.click(input);
    await user.paste("   \n  ");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/line \d+, column \d+/);
    expect(within(alert).getByText(/\^/)).toBeDefined();
  });

  it("navigates NDJSON records, resets state, and offers invocation-aware copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1}\n{"a": 2}');
    expect(screen.getByText("Record 1/2 (line 1)")).toBeDefined();
    await user.click(within(row("a")).getByText("a"));
    expect(expressionLine(".a")).toBeDefined();
    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.type(filter, ".a");
    await user.click(screen.getByRole("button", { name: "Next record" }));
    expect(screen.getByText("Record 2/2 (line 2)")).toBeDefined();
    expect(screen.queryByRole("group", { name: "Selected nodes" })).toBeNull();
    expect((filter as HTMLInputElement).value).toBe("");
    await user.click(within(row("a")).getByText("a"));
    await user.click(screen.getByRole("button", { name: "Copy per-line" }));
    await user.click(screen.getByRole("button", { name: "Copy slurped" }));
    expect(writeText).toHaveBeenCalledWith("jq '.a'");
    expect(writeText).toHaveBeenCalledWith("jq -s '.[].a'");
  });

  it("copies root and top-level array paths as valid NDJSON invocations", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('["first"]\n["second"]');

    await user.click(within(row("$")).getByText("$"));
    await user.click(screen.getByRole("button", { name: "Copy per-line" }));
    await user.click(screen.getByRole("button", { name: "Copy slurped" }));

    await user.click(within(row("$")).getByText("$"));
    await user.click(within(row("[0]")).getByText("[0]"));
    await user.click(screen.getByRole("button", { name: "Copy per-line" }));
    await user.click(screen.getByRole("button", { name: "Copy slurped" }));

    expect(writeText).toHaveBeenCalledWith("jq '.'");
    expect(writeText).toHaveBeenCalledWith("jq -s '.[]'");
    expect(writeText).toHaveBeenCalledWith("jq '.[0]'");
    expect(writeText).toHaveBeenCalledWith("jq -s '.[][0]'");
  });

  it("copies root multi-key construction as valid per-line and slurped NDJSON invocations", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"name": "first", "id": 1}\n{"name": "second", "id": 2}');

    await user.click(within(row("name")).getByText("name"));
    await user.click(within(row("id")).getByText("id"));
    expect(expressionLine(". | {name, id}")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Copy per-line" }));
    await user.click(screen.getByRole("button", { name: "Copy slurped" }));

    expect(writeText).toHaveBeenCalledWith("jq '. | {name, id}'");
    expect(writeText).toHaveBeenCalledWith("jq -s '.[] | {name, id}'");
  });

  it("shell-escapes single quotes in NDJSON jq invocations", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste(`{"it's": 1}\n{"it's": 2}`);
    await user.click(within(row("it's")).getByText("it's"));
    await user.click(screen.getByRole("button", { name: "Copy per-line" }));
    await user.click(screen.getByRole("button", { name: "Copy slurped" }));

    expect(writeText).toHaveBeenCalledWith(`jq '."it'\\''s"'`);
    expect(writeText).toHaveBeenCalledWith(`jq -s '.[]."it'\\''s"'`);
  });

  it("keeps the URL empty while navigating and selecting NDJSON records", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1}\n{"a": 2}');
    await user.click(screen.getByRole("button", { name: "Next record" }));
    await user.click(within(row("a")).getByText("a"));

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("renders malformed NDJSON lines as non-interactive errors", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste(
      `${Array.from({ length: 9 }, (_, index) => `{"a": ${index}}`).join("\n")}\nnot json`,
    );
    const error = screen.getByText("Line 10").parentElement;
    expect(error?.textContent).toContain("^");
    expect(error?.querySelector("button")).toBeNull();
  });

  it("skips malformed NDJSON lines when navigating records", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste(
      `${Array.from({ length: 9 }, (_, index) => `{"a": ${index}}`).join("\n")}\nnot json\n{"a": 10}`,
    );

    expect(screen.getByText("Record 1/10 (line 1)")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Next record" }));
    for (let index = 0; index < 8; index++)
      await user.click(screen.getByRole("button", { name: "Next record" }));
    expect(screen.getByText("Record 10/10 (line 11)")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Previous record" }));
    expect(screen.getByText("Record 9/10 (line 9)")).toBeDefined();
  });

  it("names JS-literal input in the parse error without repairing it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste("{item: 1, other: 'x',}");
    expect(screen.getByRole("alert").textContent).toContain("JavaScript literal");
    expect(screen.queryByRole("tree")).toBeNull();
  });

  it("navigates with Home, End, and treats ArrowRight on a leaf as a no-op", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1, "b": 2}');
    const tree = screen.getByRole("tree");
    tree.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{End}");
    expect(row("b").getAttribute("class")).toContain("tree-row-focused");
    await user.keyboard("{Home}");
    expect(row("$").getAttribute("class")).toContain("tree-row-focused");
  });

  it("highlights the node set a pasted iterator expression selects without manual expanding", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, {"name": "b"}]}');

    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste(".items[].name");

    expect(screen.getByText("Highlighting 2 matching nodes.")).toBeDefined();
    expect(row("name").getAttribute("aria-selected")).toBe("true");
    const names = screen
      .getAllByText("name")
      .map((element) => element.closest('[role="treeitem"]'))
      .filter((element): element is HTMLElement => element !== null);
    expect(names).toHaveLength(2);
    for (const item of names) expect(item.getAttribute("aria-selected")).toBe("true");
    expect(row("items").getAttribute("aria-selected")).toBe("false");
  });

  it("shows the explicit can't-preview state for unsupported filters", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [1]}');
    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste(".items | map(select(.))");
    expect(screen.getByText("Can't preview this filter.")).toBeDefined();
    expect(filter.getAttribute("aria-invalid")).toBe("true");
  });

  it("round-trips a generated path back through the filter to the same node", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a-b": [{"if": true}]}');
    await user.click(within(row("a-b")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("[0]")).getByRole("button", { name: /^Expand / }));
    await user.click(within(row("if")).getByText("if"));
    const generated = screen
      .getAllByText('."a-b"[0]."if"')
      .find((element) => element.className === "path-expression")?.textContent;
    if (generated === undefined || generated === null) throw new Error("no generated path");

    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste(generated);

    expect(screen.getByText("Highlighting 1 matching node.")).toBeDefined();
    expect(row("if").getAttribute("aria-selected")).toBe("true");
    expect(row("[0]").getAttribute("aria-selected")).toBe("false");
  });

  it("reports a filter that errors on the document without highlighting", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"n": 5}');
    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste(".n[]");
    expect(screen.getByText(/errors on this document/)).toBeDefined();
    expect(row("n").getAttribute("aria-selected")).toBe("false");
  });

  it("drops the selected-node highlight while the filter is unsupported or erroring", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1}');
    await user.click(within(row("a")).getByText("a"));
    expect(row("a").getAttribute("aria-selected")).toBe("true");

    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste("select(.a)");
    expect(screen.getByText("Can't preview this filter.")).toBeDefined();
    expect(row("a").getAttribute("aria-selected")).toBe("false");

    await user.clear(filter);
    await user.paste(".a[]");
    expect(screen.getByText(/errors on this document/)).toBeDefined();
    expect(row("a").getAttribute("aria-selected")).toBe("false");

    await user.clear(filter);
    expect(row("a").getAttribute("aria-selected")).toBe("true");
  });

  it("clears the filter highlight when a tree node is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"a": 1, "b": 2}');
    const filter = screen.getByLabelText("Highlight nodes matching a jq expression");
    await user.click(filter);
    await user.paste(".a");
    expect(row("a").getAttribute("aria-selected")).toBe("true");
    await user.click(within(row("b")).getByText("b"));
    expect(row("a").getAttribute("aria-selected")).toBe("false");
    expect(row("b").getAttribute("aria-selected")).toBe("true");
    expect((screen.getByLabelText(/Highlight nodes matching/) as HTMLInputElement).value).toBe("");
  });

  it("discards a stale earlier file read when a newer drop resolves first", async () => {
    render(<App />);
    const input = screen.getByLabelText("JSON document");
    let releaseSlow: (() => void) | undefined;
    const slow = fakeFile(30, '{"slow": 1}', (resolve) => {
      releaseSlow = resolve;
    });
    const fast = fakeFile(30, '{"fast": 2}');
    dropFile(input, slow);
    dropFile(input, fast);
    await waitFor(() => expect(row("fast")).toBeDefined());
    releaseSlow?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryAllByText("slow")).toHaveLength(0);
    expect(row("fast")).toBeDefined();
  });
});

describe("shipping baseline", () => {
  it("renders a skip link that targets the main content", async () => {
    const user = userEvent.setup();
    render(<App />);
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip.getAttribute("href")).toBe("#main-content");
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    await user.tab();
    expect(document.activeElement).toBe(skip);
  });

  it("renders the footer with copyright, privacy, and source links", () => {
    render(<App />);
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Jishnu Teegala");
    expect(within(footer).getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "https://jishnuteegala.com/privacy",
    );
    expect(within(footer).getByRole("link", { name: "Source" }).getAttribute("href")).toBe(
      "https://github.com/jishnuteegala/jq-pointer",
    );
  });

  it("never writes document content to the URL", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"secret-key": "secret-value"}');
    await user.click(within(row("secret-key")).getByText("secret-key"));
    expect(window.location.href).not.toContain("secret");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });
});
