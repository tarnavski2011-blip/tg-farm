import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ["nonmolecular-benson-bistred.ngrok-free.dev"],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
