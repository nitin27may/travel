// Bundles MapLibre's module worker (which imports a shared chunk) into one self-contained file, so the
// app can start it from a blob URL. Needed for the single-file build and for the Vite dev server alike.
import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "src/vendor",
    emptyOutDir: false,
    minify: true,
    lib: { entry: "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", formats: ["es"], fileName: () => "maplibre-worker.js" },
    rollupOptions: { output: { codeSplitting: false } },
  },
});
