import { describe, expect, it } from 'vitest';
import { runClickPair } from './click-pipeline';
import { buildPathModel, type ModelNode } from '../src/lib/path-model';
import type { JsonValue } from '../src/lib/json-value';

const doc: JsonValue = {
  items: [
    { name: 'a', meta: { id: 1 } },
    { name: 'b', meta: { id: 2 } },
    { name: 'c', meta: { id: 3 } },
  ],
  other: [{ name: 'z' }],
  plain: { x: 1 },
};

function descend(node: ModelNode, path: (string | number)[]): ModelNode {
  let current = node;
  for (const part of path) {
    const found =
      typeof part === 'number'
        ? current.children?.[part]
        : current.children?.find(
            (c) => c.segment?.kind === 'key' && c.segment.key === part,
          );
    if (found === undefined) throw new Error(`missing ${String(part)}`);
    current = found;
  }
  return current;
}

describe('runClickPair', () => {
  const model = buildPathModel(doc);

  it('generalises a sibling key-path pair to an iterator over the common array', () => {
    const a = descend(model.root, ['items', 0, 'meta', 'id']);
    const b = descend(model.root, ['items', 2, 'meta', 'id']);
    const result = runClickPair(a, b);
    expect(result).not.toBeNull();
    expect(result?.ancestor).toBe(descend(model.root, ['items']));
    expect(result?.steps).toEqual([
      { kind: 'iterate' },
      { kind: 'key', key: 'meta' },
      { kind: 'key', key: 'id' },
    ]);
    expect(result?.matches.map((n) => n.value)).toEqual([1, 2, 3]);
  });

  it('returns null when the key-paths differ', () => {
    const a = descend(model.root, ['items', 0, 'name']);
    const b = descend(model.root, ['items', 1, 'meta', 'id']);
    expect(runClickPair(a, b)).toBeNull();
  });

  it('returns null when there is no common array ancestor', () => {
    const a = descend(model.root, ['plain', 'x']);
    expect(runClickPair(a, a)).toBeNull();
  });

  it('keeps equal nested indices as indexed steps', () => {
    const nested: JsonValue = {
      items: [{ tags: ['x', 'y'] }, { tags: ['p', 'q'] }],
    };
    const m = buildPathModel(nested);
    const a = descend(m.root, ['items', 0, 'tags', 1]);
    const b = descend(m.root, ['items', 1, 'tags', 1]);
    const result = runClickPair(a, b);
    expect(result?.steps).toEqual([
      { kind: 'iterate' },
      { kind: 'key', key: 'tags' },
      { kind: 'index', index: 1 },
    ]);
    expect(result?.matches.map((n) => n.value)).toEqual(['y', 'q']);
  });

  it('returns null when nested indices differ', () => {
    const nested: JsonValue = {
      items: [{ tags: ['x', 'y'] }, { tags: ['p', 'q'] }],
    };
    const m = buildPathModel(nested);
    const a = descend(m.root, ['items', 0, 'tags', 0]);
    const b = descend(m.root, ['items', 1, 'tags', 1]);
    expect(runClickPair(a, b)).toBeNull();
  });
});
