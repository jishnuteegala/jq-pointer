// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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
});
