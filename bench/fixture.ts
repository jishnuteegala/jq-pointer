import type { JsonValue } from "../src/lib/json-value";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
];

function makeRecord(rand: () => number, index: number): JsonValue {
  const word = WORDS[Math.floor(rand() * WORDS.length)];
  const record: { [key: string]: JsonValue } = {
    id: index,
    name: `${word}-${index}`,
    active: rand() > 0.5,
    score: Math.round(rand() * 100000) / 100,
    "created-at": `2026-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}T12:00:00Z`,
    tags: [WORDS[Math.floor(rand() * WORDS.length)], WORDS[Math.floor(rand() * WORDS.length)]],
    meta: {
      owner: {
        login: `${word}${index}`,
        type: rand() > 0.9 ? "Organization" : "User",
        site_admin: false,
      },
      labels: Array.from({ length: 3 }, (_, i) => ({
        name: `${WORDS[Math.floor(rand() * WORDS.length)]}-${i}`,
        color: Math.floor(rand() * 0xffffff)
          .toString(16)
          .padStart(6, "0"),
      })),
      "annotations/deep": {
        "kubernetes.io/name": word,
        nested: { level1: { level2: { level3: rand() > 0.5 ? word : null } } },
      },
    },
  };
  if (rand() > 0.7) {
    record.description = null;
  } else if (rand() > 0.3) {
    record.description = `A ${word} record with some longer descriptive text to pad the payload realistically.`;
  }
  return record;
}

export function generateFixture(targetBytes: number): { json: string; itemCount: number } {
  const rand = mulberry32(42);
  const items: JsonValue[] = [];
  const parts: string[] = [];
  let size = 64;
  let index = 0;
  while (size < targetBytes) {
    const record = makeRecord(rand, index);
    const serialized = JSON.stringify(record);
    parts.push(serialized);
    items.push(record);
    size += serialized.length + 1;
    index++;
  }
  const json = `{"kind":"RecordList","apiVersion":"v1","items":[${parts.join(",")}]}`;
  return { json, itemCount: index };
}
