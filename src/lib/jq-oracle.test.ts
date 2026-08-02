import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { platform } from "node:os";
import {
  array,
  assert,
  boolean,
  constantFrom,
  integer,
  jsonValue,
  oneof,
  property,
  string,
  subarray,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";
import {
  evaluateJqExpression,
  parseExpression,
  printExpression,
  printPath,
  type JqExpression,
} from "./jq-expression";
import { copyInvocation } from "./jq-invocation";
import type { JsonValue } from "./json-value";
import { buildPathModel, pathTo } from "./path-model";

const jqBinaries = (
  process.env.JQ_BINARIES?.split(":") ?? readdirSync(".").map((name) => `./${name}`)
)
  .filter((jq) => jq.startsWith("./jq-"))
  .filter((jq) => existsSync(jq))
  .toSorted();

function runJq(jq: string, document: unknown, expression: string): unknown[] {
  const output = execFileSync(jq, ["--compact-output", expression], {
    encoding: "utf8",
    input: JSON.stringify(document),
  });
  return output.trim() === ""
    ? []
    : output
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown);
}

function runInvocation(jq: string, command: string, input: string): unknown[] {
  const output = execFileSync("sh", ["-c", command.replace(/^jq /, `${JSON.stringify(jq)} `)], {
    encoding: "utf8",
    input,
  });
  return output.trim() === ""
    ? []
    : output
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown);
}

const oracle = platform() === "win32" || jqBinaries.length === 0 ? describe.skip : describe;

if (platform() === "win32" || jqBinaries.length === 0)
  describe("jq printer oracle", () => {
    it.skip("requires a local jq binary on a non-Windows platform", () => {});
  });

for (const jq of jqBinaries)
  oracle(`jq ${basename(jq)} printer oracle`, () => {
    it("accepts and evaluates emitted key paths", () => {
      assert(
        property(string({ unit: constantFrom("a", "-", " ", '"', "\\", "😀") }), (key) => {
          const document = { [key]: key };
          expect(runJq(jq, document, printPath([{ kind: "key", key }]))).toEqual([key]);
        }),
        { numRuns: 100, seed: 7 },
      );
    });

    it("matches jq iterator and optional step behavior", () => {
      const document = { items: [{ name: "a" }, {}, { name: "c" }] };
      const expression: JqExpression = {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate" },
          { kind: "key", key: "name", optional: true },
        ],
      };
      expect(runJq(jq, document, printPath(expression.steps))).toEqual(["a", null, "c"]);
      expect(
        runJq(
          jq,
          { items: [1, { child: { value: "a" } }, { child: 2 }] },
          ".items[].child?.value?",
        ),
      ).toEqual(["a"]);
      expect(
        runJq(
          jq,
          { items: [1, { child: [{ value: "a" }] }, { child: 2 }] },
          ".items[].child?[]?.value?",
        ),
      ).toEqual(["a"]);
    });

    it("matches jq for parsed paths", () => {
      const document = {
        items: [
          { name: "a", "a-b": 1, "face 😀": true },
          { name: "b", "a-b": 2, "face 😀": false },
        ],
      };
      const expression: JqExpression = {
        kind: "path",
        steps: [
          { kind: "key", key: "items" },
          { kind: "iterate" },
          { kind: "key", key: "face 😀" },
        ],
      };
      const printed = printExpression(expression);
      const parsed = parseExpression(printed);
      if (parsed === null) throw new Error("printed expression did not parse");
      expect(
        evaluateJqExpression(buildPathModel(document).root, parsed).map((node) => node.value),
      ).toEqual(runJq(jq, document, printed));
    });

    it("matches jq semantic results for generated heterogeneous documents and paths", () => {
      const step = oneof(
        constantFrom("name", "a-b", "child", "nested", "value", "missing").map(
          (key) => ({ kind: "key", key, optional: true }) as const,
        ),
        constantFrom({ kind: "iterate", optional: true } as const),
        integer({ min: -2, max: 2 }).map(
          (index) => ({ kind: "index", index, optional: true }) as const,
        ),
      );
      assert(
        property(
          array(
            jsonValue({ maxDepth: 3 }).map((value) => value as JsonValue),
            { maxLength: 8 },
          ),
          array(step, { minLength: 1, maxLength: 5 }),
          (items, suffix) => {
            const document = { items };
            const expression: JqExpression = {
              kind: "path",
              steps: [
                { kind: "key", key: "items" },
                { kind: "iterate", optional: true },
                ...suffix,
              ],
            };
            const printed = printExpression(expression);
            const parsed = parseExpression(printed);
            if (parsed === null) throw new Error("printed expression did not parse");
            expect(
              evaluateJqExpression(buildPathModel(document).root, parsed).map((node) => node.value),
            ).toEqual(runJq(jq, document, printed));
          },
        ),
        { numRuns: 100, seed: 17 },
      );
    });

    it("matches jq for generated flat constructions with null and missing fields", () => {
      const constructionKeys = ["name", "a-b", "nested", "if"] as const;
      assert(
        property(
          array(
            tuple(
              boolean(),
              boolean(),
              boolean(),
              boolean(),
              jsonValue({ maxDepth: 3 }).map((value) => value as JsonValue),
            ).map(([hasName, hasDashedKey, hasNested, hasKeyword, value]) => {
              const item: Record<string, JsonValue> = {};
              if (hasName) item.name = value;
              if (hasDashedKey) item["a-b"] = null;
              if (hasNested) item.nested = { value };
              if (hasKeyword) item.if = value;
              return item;
            }),
            { maxLength: 8 },
          ),
          subarray([...constructionKeys], { minLength: 1 }),
          (items, keys) => {
            const document = { items };
            const expression: JqExpression = {
              kind: "construction",
              source: {
                kind: "path",
                steps: [
                  { kind: "key", key: "items" },
                  { kind: "iterate", optional: true },
                ],
              },
              keys,
            };
            const printed = printExpression(expression);
            expect(parseExpression(printed)).toEqual(expression);
            expect(runJq(jq, document, printed)).toEqual(
              items.map((item) => Object.fromEntries(keys.map((key) => [key, item[key] ?? null]))),
            );
          },
        ),
        { numRuns: 100, seed: 23 },
      );
    });

    it("matches jq for paths generated from every addressable model node", () => {
      const document = { items: [{ name: "a" }, { name: "b" }], meta: { "a-b": true } };
      const model = buildPathModel(document);
      const nodes = [model.root];
      for (let index = 0; index < nodes.length; index++)
        nodes.push(...(nodes[index].children ?? []));
      for (const node of nodes.filter((candidate) => candidate.jqAddressable)) {
        const result = pathTo(node);
        if (result.kind === "unsupported") throw new Error("addressable node did not have a path");
        const expression = printPath(result.segments);
        const parsed = parseExpression(expression);
        if (parsed === null) throw new Error("generated expression did not parse");
        expect(
          evaluateJqExpression(model.root, parsed).map((matchedNode) => matchedNode.value),
        ).toEqual([node.value]);
        expect(runJq(jq, document, expression)).toEqual([node.value]);
      }
    });

    it("prints flat constructions jq evaluates as objects", () => {
      const document = {
        items: [
          { name: "a", "a-b": 1 },
          { name: "b", "a-b": 2 },
        ],
      };
      const expression: JqExpression = {
        kind: "construction",
        source: { kind: "path", steps: [{ kind: "key", key: "items" }, { kind: "iterate" }] },
        keys: ["name", "a-b"],
      };
      const printed = printExpression(expression);
      expect(parseExpression(printed)).toEqual(expression);
      expect(runJq(jq, document, printed)).toEqual([
        { name: "a", "a-b": 1 },
        { name: "b", "a-b": 2 },
      ]);
    });

    it("runs copied invocations as the raw expression for each NDJSON record", () => {
      const step = oneof(
        constantFrom("name", "a-b", "child", "nested", "value", "missing").map(
          (key) => ({ kind: "key", key, optional: true }) as const,
        ),
        constantFrom({ kind: "iterate", optional: true } as const),
        integer({ min: -2, max: 2 }).map(
          (index) => ({ kind: "index", index, optional: true }) as const,
        ),
      );
      assert(
        property(
          array(jsonValue({ maxDepth: 3 }), { minLength: 1, maxLength: 5 }),
          array(step, { minLength: 0, maxLength: 4 }),
          (records, steps) => {
            const expression = printExpression({ kind: "path", steps });
            const input = records.map((record) => JSON.stringify(record)).join("\n");
            const expected = records.flatMap((record) => runJq(jq, record, expression));
            expect(runInvocation(jq, copyInvocation(expression, false), input)).toEqual(expected);
            expect(runInvocation(jq, copyInvocation(expression, true), input)).toEqual(expected);
          },
        ),
        { numRuns: 100, seed: 29 },
      );
    });

    it("runs copied construction invocations for each NDJSON record", () => {
      const keys = ["name", "a-b", "if"] as const;
      assert(
        property(
          array(
            tuple(
              boolean(),
              boolean(),
              boolean(),
              jsonValue({ maxDepth: 3 }).map((value) => value as JsonValue),
            ).map(([hasName, hasDashedKey, hasKeyword, value]) => {
              const record: Record<string, JsonValue> = {};
              if (hasName) record.name = value;
              if (hasDashedKey) record["a-b"] = value;
              if (hasKeyword) record.if = value;
              return record;
            }),
            { minLength: 1, maxLength: 5 },
          ),
          subarray([...keys], { minLength: 1 }),
          (records, selectedKeys) => {
            const expression = printExpression({
              kind: "construction",
              source: { kind: "path", steps: [] },
              keys: selectedKeys,
            });
            const input = records.map((record) => JSON.stringify(record)).join("\n");
            const expected = records.flatMap((record) => runJq(jq, record, expression));
            expect(runInvocation(jq, copyInvocation(expression, false), input)).toEqual(expected);
            expect(runInvocation(jq, copyInvocation(expression, true), input)).toEqual(expected);
          },
        ),
        { numRuns: 100, seed: 31 },
      );
    });
  });
