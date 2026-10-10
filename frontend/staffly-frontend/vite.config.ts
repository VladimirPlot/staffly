import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { randomUUID } from "node:crypto";

const buildId = randomUUID();

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
  },

  plugins: [
    {
      name: "staffly-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ buildId }) });
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "prompt",
      injectRegister: false,

      manifest: {
        id: "/", // убирает warning в DevTools
        name: "Staffly",
        short_name: "Staffly",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#111827",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      injectManifest: {
        swSrc: "src/sw.ts",
        globIgnores: ["**/version.json"],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 🔹 базовый каркас SPA
          react: ["react", "react-dom", "react-router-dom"],

          // 🔹 иконки (lucide реально много весит)
          icons: ["lucide-react"],
        },
      },
    },
  },
});
