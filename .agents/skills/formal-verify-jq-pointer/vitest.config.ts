import { defineConfig } from "vitest/config";

// Standalone config for the formal check: the repo's vitest projects only
// include src/**, so this check runs under its own root with the default
// node environment (the pipeline is pure - no DOM needed).
export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["check.test.ts"],
    environment: "node",
  },
});
