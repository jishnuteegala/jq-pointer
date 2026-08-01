export function percentile(values: number[], p: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export function coldStart(timings: number[]): number {
  return timings[0];
}
