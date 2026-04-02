import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "icons/*.png", dest: "icons" },
      ],
    }),
  ],
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/popup.html"),
        "background/service-worker": resolve(
          __dirname,
          "background/service-worker.ts",
        ),
        "content/inject": resolve(__dirname, "content/inject.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background/service-worker") {
            return "background/service-worker.js";
          }
          if (chunkInfo.name === "content/inject") {
            return "content/inject.js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
