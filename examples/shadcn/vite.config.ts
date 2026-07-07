import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" so the built demo can be served from any subpath (e.g. /demos/shadcn/).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
