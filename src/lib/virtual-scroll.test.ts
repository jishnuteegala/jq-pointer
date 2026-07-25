import { describe, expect, it } from "vitest";
import { computeWindow, MAX_SPACER_HEIGHT, scrollTopForRow } from "./virtual-scroll";

const ROW = 28;
const VIEWPORT = 480;

describe("computeWindow", () => {
  it("maps scroll positions directly when content fits browser limits", () => {
    const window = computeWindow(1000, ROW, 280, VIEWPORT, 2);
    expect(window.spacerHeight).toBe(28000);
    expect(window.start).toBe(8);
    expect(window.end).toBe(Math.ceil((280 + VIEWPORT) / ROW) + 2);
    expect(window.offsetFor(10)).toBe(280);
  });

  it("clamps the spacer and still reaches the last row of 5M rows", () => {
    const rowCount = 5_000_000;
    const window = computeWindow(rowCount, ROW, 0, VIEWPORT, 2);
    expect(window.spacerHeight).toBe(MAX_SPACER_HEIGHT);
    expect(window.start).toBe(0);

    const bottom = computeWindow(rowCount, ROW, MAX_SPACER_HEIGHT - VIEWPORT, VIEWPORT, 2);
    expect(bottom.end).toBe(rowCount);
    expect(bottom.start).toBeLessThan(rowCount);
    const lastOffset = bottom.offsetFor(rowCount - 1);
    expect(lastOffset).toBeGreaterThanOrEqual(MAX_SPACER_HEIGHT - VIEWPORT);
    expect(lastOffset).toBeLessThanOrEqual(MAX_SPACER_HEIGHT);
  });

  it("keeps every row reachable at intermediate scroll positions", () => {
    const rowCount = 5_000_000;
    const half = (MAX_SPACER_HEIGHT - VIEWPORT) / 2;
    const window = computeWindow(rowCount, ROW, half, VIEWPORT, 2);
    expect(window.start).toBeGreaterThan(2_000_000);
    expect(window.end).toBeLessThan(3_000_000);
    for (let index = window.start; index < window.end; index++) {
      const offset = window.offsetFor(index);
      expect(offset).toBeGreaterThanOrEqual(half - 3 * ROW);
      expect(offset).toBeLessThanOrEqual(half + VIEWPORT + 3 * ROW);
    }
  });
});

describe("scrollTopForRow", () => {
  it("returns the current scroll when the row is already visible", () => {
    expect(scrollTopForRow(5, 1000, ROW, 0, VIEWPORT)).toBe(0);
  });

  it("scrolls a distant row into view under clamped heights", () => {
    const rowCount = 5_000_000;
    const target = scrollTopForRow(rowCount - 1, rowCount, ROW, 0, VIEWPORT);
    const window = computeWindow(rowCount, ROW, target, VIEWPORT, 2);
    expect(window.end).toBe(rowCount);
    expect(window.start).toBeLessThanOrEqual(rowCount - 1);
  });
});
