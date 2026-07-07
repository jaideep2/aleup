import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the built demo can be served from any subpath (e.g. /demos/mui/).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
