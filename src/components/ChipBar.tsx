import type { ModelNode } from "../lib/path-model";

interface ChipBarProps {
  clicks: ModelNode[];
  labelOf: (node: ModelNode) => string;
  onRemove: (index: number) => void;
  onClear: () => void;
}

export function ChipBar({ clicks, labelOf, onRemove, onClear }: ChipBarProps) {
  if (clicks.length === 0) return null;
  return (
    <div className="chip-bar" role="group" aria-label="Selected nodes">
      <ul className="chip-list">
        {clicks.map((node, index) => (
          <li key={index} className="chip">
            <span className="chip-label">{labelOf(node)}</span>
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${labelOf(node)}`}
              onClick={() => onRemove(index)}
            >
              {"\u00d7"}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="chip-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
