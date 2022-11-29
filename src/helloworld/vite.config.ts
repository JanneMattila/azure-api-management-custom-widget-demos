import { defineConfig } from "vite"

export default defineConfig({
  root: "./src",
  base: "",
  server: {
    "port": 3000,
    "open": "https://<service>.developer.azure-api.net/?MS_APIM_CW_localhost_port=3000"
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: "./src/index.html",
        editor: "./src/editor.html",
      },
    },
  },
  publicDir: "../static",
})
