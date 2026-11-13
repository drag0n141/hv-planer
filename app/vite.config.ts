import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// The app is served by the Node server below /v2 while the legacy planner keeps "/".
export default defineConfig({
  base: "/v2/",
  plugins: [svelte()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/login": "http://localhost:8080",
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
