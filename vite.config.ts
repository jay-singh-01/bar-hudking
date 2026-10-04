import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "BarHudking",
        short_name: "BarHudking",
        description: "Find Bangalore's best bars, pubs, breweries, cafés and restaurants",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        categories: ["food", "lifestyle", "travel"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Map", url: "/map" },
          { name: "Saved", url: "/saved" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Place thumbnails are cached as they are viewed, not pre-downloaded.
        globIgnores: ["photos/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/data\//],
        runtimeCaching: [
          {
            // The place catalogue: serve the cached copy instantly, refresh in the background.
            urlPattern: ({ url }) => url.pathname === "/data/places.json",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "places-data", expiration: { maxEntries: 2 } },
          },
          {
            // Map tiles from any provider: /{z}/{x}/{y}.png
            urlPattern: ({ url }) => /\/\d+\/\d+\/\d+(@2x)?\.(png|jpg)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /googleusercontent\.com$|ggpht\.com$/.test(url.hostname) || url.pathname.startsWith("/photos/"),
            handler: "CacheFirst",
            options: {
              cacheName: "place-photos",
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
