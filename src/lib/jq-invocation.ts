export function copyInvocation(expression: string, slurped: boolean): string {
  const filter = slurped
    ? expression === "."
      ? ".[]"
      : expression.startsWith(". ")
        ? `.[]${expression.slice(1)}`
        : `.[]${expression.startsWith(".[") ? expression.slice(1) : expression}`
    : expression;
  return `jq${slurped ? " -s" : ""} '${filter.replaceAll("'", "'\\''")}'`;
}
