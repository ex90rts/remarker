import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    // Affected Chromium releases cannot reuse modulepreload requests from
    // extension pages because the preload and module execute in different worlds.
    // These packaged chunks are local, so skipping preload hints is low-cost.
    modulePreload: false,
    rollupOptions: {
      input: {
        options: "options.html",
        popup: "popup.html",
        "service-worker": "src/background/service-worker.ts"
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
