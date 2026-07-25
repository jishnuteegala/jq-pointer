export const MAX_SPACER_HEIGHT = 6_000_000;

export interface VirtualWindow {
  spacerHeight: number;
  start: number;
  end: number;
  offsetFor: (index: number) => number;
}

export function computeWindow(
  rowCount: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): VirtualWindow {
  const contentHeight = rowCount * rowHeight;
  const spacerHeight = Math.min(contentHeight, MAX_SPACER_HEIGHT);
  const maxScrollTop = Math.max(0, spacerHeight - viewportHeight);
  const maxContentScrollTop = Math.max(0, contentHeight - viewportHeight);
  const contentScrollTop =
    maxScrollTop === 0 ? 0 : (scrollTop / maxScrollTop) * maxContentScrollTop;
  const start = Math.max(0, Math.floor(contentScrollTop / rowHeight) - overscan);
  const end = Math.min(
    rowCount,
    Math.ceil((contentScrollTop + viewportHeight) / rowHeight) + overscan,
  );
  const offsetFor = (index: number) => scrollTop + index * rowHeight - contentScrollTop;
  return { spacerHeight, start, end, offsetFor };
}

export function scrollTopForRow(
  index: number,
  rowCount: number,
  rowHeight: number,
  currentScrollTop: number,
  viewportHeight: number,
): number {
  const contentHeight = rowCount * rowHeight;
  const spacerHeight = Math.min(contentHeight, MAX_SPACER_HEIGHT);
  const maxScrollTop = Math.max(0, spacerHeight - viewportHeight);
  const maxContentScrollTop = Math.max(0, contentHeight - viewportHeight);
  const contentScrollTop =
    maxScrollTop === 0 ? 0 : (currentScrollTop / maxScrollTop) * maxContentScrollTop;
  const rowTop = index * rowHeight;
  let target = contentScrollTop;
  if (rowTop < contentScrollTop) target = rowTop;
  else if (rowTop + rowHeight > contentScrollTop + viewportHeight) {
    target = rowTop + rowHeight - viewportHeight;
  } else return currentScrollTop;
  return maxContentScrollTop === 0 ? 0 : (target / maxContentScrollTop) * maxScrollTop;
}
