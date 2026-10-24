import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Standalone config for the formal check: the repo's vitest projects only
// include src/**, so this check runs under its own root with the default
// node environment (the pipeline is pure - no DOM needed). cacheDir points
// back at the repo's node_modules so the vite cache does not accumulate
// inside the committed skill directory (a transient empty .vite-temp still
// appears under the skill dir's node_modules and is ignored).
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: resolve(import.meta.dirname, "../../../node_modules/.vite-formal-verify"),
  test: {
    include: ["check.test.ts"],
    environment: "node",
  },
});
