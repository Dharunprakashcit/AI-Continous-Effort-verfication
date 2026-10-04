import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/ann": {
        target: "http://localhost:5001",
        rewrite: (path) => path.replace(/^\/ann/, ""),
      },
    },
  },
});
