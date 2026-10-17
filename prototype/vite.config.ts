import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode single` makes one self-contained HTML file (the published prototype); relief images stay
// beside it in dist-single/. The normal build is a regular static site.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  build: { outDir: mode === "single" ? "dist-single" : "dist", chunkSizeWarningLimit: 4000, assetsInlineLimit: mode === "single" ? 0 : 4096 },
  server: { fs: { allow: [".."] } },
}));
