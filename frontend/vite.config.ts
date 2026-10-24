import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react(), {
    name: "filebrowser-runtime-config",
    transformIndexHtml: {
      order: "post",
      handler: () => [{ tag: "script", attrs: { src: "/runtime-config.js" }, injectTo: "head" }],
    },
    configureServer(server) {
      server.middlewares.use("/runtime-config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.end("window.__FILEBROWSER_CONFIG__ = {BaseURL: ''};");
      });
    },
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  worker: { format: "es" },
  build: {
    outDir: "out",
    emptyOutDir: true,
  },
}));
