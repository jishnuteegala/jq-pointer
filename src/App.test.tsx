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

    await user.click(within(row("arr")).getByText("arr"));
    const first = within(row("[0]")).getByText("[0]");
    await user.click(first);

    expect(screen.getByText(".arr[0]")).toBeDefined();
    expect(row("[0]").getAttribute("aria-selected")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(".arr[0]");
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
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
    await user.click(within(row("arr")).getByText("arr"));
    await user.click(within(row("[0]")).getByText("[0]"));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByText(/Couldn.t copy/)).toBeDefined();
  });

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
    expect((screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement).disabled).toBe(true);
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

  it("highlights the node set a pasted iterator expression selects", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("JSON document"));
    await user.paste('{"items": [{"name": "a"}, {"name": "b"}]}');
    await user.click(within(row("items")).getByText("items"));
    await user.click(within(row("[0]")).getByText("[0]"));
    await user.click(within(row("[1]")).getByText("[1]"));

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
    await user.click(within(row("a-b")).getByText("a-b"));
    await user.click(within(row("[0]")).getByText("[0]"));
    await user.click(within(row("if")).getByText("if"));
    const generated = screen.getByText('."a-b"[0]."if"').textContent;
    if (generated === null) throw new Error("no generated path");

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
