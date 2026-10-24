import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const llmsTxtSource = () => readFileSync(resolve(import.meta.dirname, "llms.txt"), "utf-8");

function llmsTxt(): Plugin {
  return {
    name: "jq-pointer-llms-txt",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/llms.txt") {
          next();
          return;
        }
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(llmsTxtSource());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "llms.txt", source: llmsTxtSource() });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    llmsTxt(),
    VitePWA({
      injectRegister: "script",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "jq-pointer",
        short_name: "jq-pointer",
        description:
          "Paste JSON, click the value you want, get the jq expression that extracts it.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#eceef3",
        background_color: "#eceef3",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "design-system": resolve(import.meta.dirname, "design-system/index.html"),
      },
    },
  },
  test: {
    // --expose-gc lets bench sample loops reclaim each iteration's garbage in
    // untimed space; production callers pay GC in idle time between clicks,
    // but a back-to-back loop would otherwise amortise that debt into timed
    // samples and flake the p95 gate. The flag is global to all forks workers
    // (poolOptions lives at the root), not just the bench project.
    poolOptions: { forks: { execArgv: ["--expose-gc"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "bench",
          include: ["bench/**/*.test.ts"],
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
