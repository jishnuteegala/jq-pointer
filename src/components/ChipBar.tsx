import { useLayoutEffect, useRef } from "react";
import type { ModelNode } from "../lib/path-model";

interface ChipBarProps {
  clicks: ModelNode[];
  labelOf: (node: ModelNode) => string;
  onRemove: (index: number) => void;
  onClear: () => void;
  onEmptied?: () => void;
}

export function ChipBar({ clicks, labelOf, onRemove, onClear, onEmptied }: ChipBarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(".chip-remove");
    const index = pendingFocus.current;
    pendingFocus.current = null;
    if (buttons === undefined || buttons.length === 0) {
      clearRef.current?.focus();
      return;
    }
    (buttons[Math.min(index, buttons.length - 1)] ?? clearRef.current)?.focus();
  }, [clicks]);

  if (clicks.length === 0) return null;

  const removeAndRefocus = (index: number) => {
    if (clicks.length === 1) {
      onRemove(index);
      onEmptied?.();
      return;
    }
    pendingFocus.current = index;
    onRemove(index);
  };

  return (
    <fieldset className="chip-bar" aria-label="Selected nodes">
      <ul ref={listRef} className="chip-list">
        {clicks.map((node, index) => (
          <li key={index} className="chip">
            <span className="chip-label">{labelOf(node)}</span>
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${labelOf(node)}`}
              onClick={() => removeAndRefocus(index)}
            >
              {"\u00d7"}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="chip-clear"
        ref={clearRef}
        onClick={() => {
          onClear();
          onEmptied?.();
        }}
      >
        Clear
      </button>
    </fieldset>
  );
}
