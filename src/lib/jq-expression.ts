import { evaluateSteps, type ModelNode, type PathStep } from "./path-model";

const identifier = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const keywords = new Set([
  "as",
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
  "reduce",
  "then",
  "try",
  "until",
  "while",
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
    else if (code !== undefined && code >= 0xd800 && code <= 0xdfff) result += "�";
    else result += character;
  }
  return `${result}"`;
}

export function printKey(key: string): string {
  return identifier.test(key) && !keywords.has(key) ? `.${key}` : `.${quoteKey(key)}`;
}

export function printPath(steps: PathStep[]): string {
  let result = ".";
  for (const step of steps) {
    if (step.kind === "key") result += printKey(step.key).slice(1);
    else if (step.kind === "index") result += `[${step.index}]`;
    else result += "[]";
    if (step.optional) result += "?";
  }
  return result;
}

export function printExpression(expression: JqExpression): string {
  if (expression.kind === "path") return printPath(expression.steps);
  const fields = expression.keys
    .map((key) => (identifier.test(key) && !keywords.has(key) ? key : quoteKey(key)))
    .join(", ");
  return `${printPath(expression.source.steps)} | {${fields}}`;
}

export function evaluateExpression(root: ModelNode, expression: JqExpression): ModelNode[] {
  const source = evaluateSteps(
    root,
    expression.kind === "path" ? expression.steps : expression.source.steps,
  );
  if (expression.kind === "path") return source;
  return source.flatMap((node) =>
    expression.keys.flatMap((key) => evaluateSteps(node, [{ kind: "key", key }])),
  );
}

export function parseExpression(input: string): JqExpression | null {
  const construction = input.match(/^(.*) \| \{(.*)\}$/);
  if (construction !== null) {
    const source = parsePath(construction[1]);
    const keys = parseFields(construction[2]);
    return source === null || keys === null ? null : { kind: "construction", source, keys };
  }
  return parsePath(input);
}

function parseFields(input: string): string[] | null {
  if (input === "") return [];
  const keys: string[] = [];
  let remaining = input;
  while (remaining !== "") {
    const match = remaining.match(/^([a-zA-Z_][a-zA-Z_0-9]*|"(?:[^"\\]|\\.)*")(?:, )?/);
    if (match === null) return null;
    const token = match[1];
    const key = token.startsWith('"') ? parseString(token) : token;
    if (key === null) return null;
    keys.push(key);
    remaining = remaining.slice(match[0].length);
  }
  return keys;
}

function parsePath(input: string): PathExpression | null {
  if (!input.startsWith(".")) return null;
  const steps: PathStep[] = [];
  let remaining = input.slice(1);
  while (remaining !== "") {
    const match = remaining.match(
      /^(\[\]|\[-?\d+\]|\.?[a-zA-Z_][a-zA-Z_0-9]*|\.?"(?:[^"\\]|\\.)*")(\?)?/,
    );
    if (match === null) return null;
    const token = match[1];
    const optional = match[2] === "?" ? { optional: true } : {};
    if (token === "[]") steps.push({ kind: "iterate", ...optional });
    else if (token.startsWith("["))
      steps.push({ kind: "index", index: Number(token.slice(1, -1)), ...optional });
    else {
      const rawKey = token.startsWith(".") ? token.slice(1) : token;
      const key = rawKey.startsWith('"') ? parseString(rawKey) : rawKey;
      if (key === null) return null;
      steps.push({ kind: "key", key, ...optional });
    }
    remaining = remaining.slice(match[0].length);
  }
  return { kind: "path", steps };
}

function parseString(input: string): string | null {
  try {
    const value: unknown = JSON.parse(input);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
