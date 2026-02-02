import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "prompt",

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

          // 🔹 PWA / register (если будет использован в app-коде)
          pwa: ["virtual:pwa-register"],
        },
      },
    },
  },
});
