import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const apiPort = process.env.VITE_API_PORT ?? process.env.API_PORT ?? process.env.PORT ?? "3000";
const webPort = process.env.WEB_PORT ?? "5173";

export default defineConfig({
  envDir: process.env.NODE_ENV === "test" ? false : undefined,
  resolve: { alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  server: {
    watch: { ignored: ["**/artifacts/**"] },
    host: "127.0.0.1",
    port: Number(webPort),
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
    },
  },
});
