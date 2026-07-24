import { evaluateSteps, matchingNodes, type ModelNode, type PathStep } from "./path-model";

const identifier = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const keywords = new Set([
  "as",
  "and",
  "break",
  "catch",
  "def",
  "elif",
  "else",
  "end",
  "foreach",
  "if",
  "import",
  "include",
  "label",
  "module",
  "not",
  "null",
  "or",
  "reduce",
  "then",
  "true",
  "try",
  "until",
  "while",
  "false",
]);

export interface PathExpression {
  kind: "path";
  steps: PathStep[];
}

export interface ConstructionExpression {
  kind: "construction";
  source: PathExpression;
  keys: string[];
}

export type JqExpression = PathExpression | ConstructionExpression;

export function quoteKey(key: string): string {
  if (hasLoneSurrogate(key)) throw new RangeError("jq cannot represent keys with lone surrogates");
  let result = '"';
  for (const character of key) {
    const code = character.codePointAt(0);
    if (character === '"') result += '\\"';
    else if (character === "\\") result += "\\\\";
    else if (character === "\b") result += "\\b";
    else if (character === "\t") result += "\\t";
    else if (character === "\n") result += "\\n";
    else if (character === "\f") result += "\\f";
    else if (character === "\r") result += "\\r";
    else if (code !== undefined && code <= 0x1f)
      result += `\\u${code.toString(16).padStart(4, "0")}`;
    else result += character;
  }
  return `${result}"`;
}

export function printKey(key: string): string {
  return identifier.test(key) && !keywords.has(key) ? `.${key}` : `.${quoteKey(key)}`;
}

export function printPath(steps: PathStep[]): string {
  let result = ".";
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (step.kind === "key")
      result += index === 0 ? printKey(step.key).slice(1) : printKey(step.key);
    else if (step.kind === "index") result += `[${step.index}]`;
    else result += "[]";
    if (step.optional) result += "?";
  }
  return result;
}

export function printExpression(expression: JqExpression): string {
  if (expression.kind === "path") return printPath(expression.steps);
  const fields = [...new Set(expression.keys)]
    .map((key) => (identifier.test(key) && !keywords.has(key) ? key : quoteKey(key)))
    .join(", ");
  return `${printPath(expression.source.steps)} | {${fields}}`;
}

/** Evaluates jq's value stream, including synthetic nulls for absent fields. */
export function evaluateJqExpression(root: ModelNode, expression: JqExpression): ModelNode[] {
  const source = evaluateSteps(
    root,
    expression.kind === "path" ? expression.steps : expression.source.steps,
  );
  if (expression.kind === "path") return source;
  const keys = [...new Set(expression.keys)];
  return source.flatMap((node) =>
    keys.flatMap((key) => evaluateSteps(node, [{ kind: "key", key }])),
  );
}

/** Evaluates an expression to highlightable document nodes, excluding absent jq nulls. */
export function evaluateExpression(root: ModelNode, expression: JqExpression): ModelNode[] {
  const source = matchingNodes(
    root,
    expression.kind === "path" ? expression.steps : expression.source.steps,
  );
  if (expression.kind === "path") return source;
  const keys = [...new Set(expression.keys)];
  return source.flatMap((node) =>
    keys.flatMap((key) => matchingNodes(node, [{ kind: "key", key }])),
  );
}

export function parseExpression(input: string): JqExpression | null {
  const delimiter = constructionDelimiter(input);
  if (delimiter !== null && input.endsWith("}")) {
    const source = parsePath(input.slice(0, delimiter));
    const keys = parseFields(input.slice(delimiter + 4, -1));
    return source === null || keys === null || new Set(keys).size !== keys.length
      ? null
      : { kind: "construction", source, keys };
  }
  return parsePath(input);
}

function constructionDelimiter(input: string): number | null {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < input.length - 3; index++) {
    const character = input[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (input.startsWith(" | {", index)) return index;
  }
  return null;
}

function parseFields(input: string): string[] | null {
  if (input === "") return [];
  const keys: string[] = [];
  let remaining = input;
  while (remaining !== "") {
    const match = remaining.match(/^([a-zA-Z_][a-zA-Z_0-9]*|"(?:[^"\\]|\\.)*")/);
    if (match === null) return null;
    const token = match[1];
    const key = token.startsWith('"') ? parseString(token) : token;
    if (
      key === null ||
      (!token.startsWith('"') && keywords.has(key)) ||
      (token.startsWith('"') && identifier.test(key) && !keywords.has(key))
    )
      return null;
    keys.push(key);
    remaining = remaining.slice(match[0].length);
    if (remaining === "") break;
    if (!remaining.startsWith(", ")) return null;
    remaining = remaining.slice(2);
    if (remaining === "") return null;
  }
  return keys;
}

function parsePath(input: string): PathExpression | null {
  if (!input.startsWith(".")) return null;
  const steps: PathStep[] = [];
  let remaining = input.slice(1);
  let isFirst = true;
  while (remaining !== "") {
    const match = remaining.match(
      isFirst
        ? /^(\[\]|\[-?\d+\]|[a-zA-Z_][a-zA-Z_0-9]*|"(?:[^"\\]|\\.)*")(\?)?/
        : /^(\[\]|\[-?\d+\]|\.[a-zA-Z_][a-zA-Z_0-9]*|\."(?:[^"\\]|\\.)*")(\?)?/,
    );
    if (match === null) return null;
    const token = match[1];
    const optional = match[2] === "?" ? { optional: true } : {};
    if (token === "[]") steps.push({ kind: "iterate", ...optional });
    else if (token.startsWith("[")) {
      const rawIndex = token.slice(1, -1);
      const index = Number(rawIndex);
      if (!Number.isSafeInteger(index)) return null;
      if (String(index) !== rawIndex) return null;
      steps.push({ kind: "index", index, ...optional });
    } else {
      const rawKey = token.startsWith(".") ? token.slice(1) : token;
      const key = rawKey.startsWith('"') ? parseString(rawKey) : rawKey;
      if (
        key === null ||
        (!rawKey.startsWith('"') && keywords.has(key)) ||
        (rawKey.startsWith('"') && identifier.test(key) && !keywords.has(key))
      )
        return null;
      steps.push({ kind: "key", key, ...optional });
    }
    remaining = remaining.slice(match[0].length);
    isFirst = false;
  }
  return { kind: "path", steps };
}

function parseString(input: string): string | null {
  try {
    const value: unknown = JSON.parse(input);
    return typeof value === "string" && !hasLoneSurrogate(value) && input === quoteKey(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
        index++;
      } else return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}
