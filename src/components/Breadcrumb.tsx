import type { ModelNode } from "../lib/path-model";

interface BreadcrumbProps {
  ancestors: ModelNode[];
  activeIndex: number;
  labelOf: (node: ModelNode) => string;
  onWiden: (index: number) => void;
}

export function Breadcrumb({ ancestors, activeIndex, labelOf, onWiden }: BreadcrumbProps) {
  return (
    <div className="breadcrumb" role="group" aria-label="Widen the iterated array">
      <span className="breadcrumb-label">Iterate over:</span>
      {ancestors.map((node, index) => (
        <button
          key={index}
          type="button"
          className={`breadcrumb-item${index === activeIndex ? " breadcrumb-item-active" : ""}`}
          aria-pressed={index === activeIndex}
          onClick={() => onWiden(index)}
        >
          {labelOf(node)}
        </button>
      ))}
    </div>
  );
}
