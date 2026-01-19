import {defineConfig} from "vite"
import {resolve} from "path"

export default defineConfig({
  root: "./src",
  base: "",
  server: {
	"port": 3000,
	"open": true
},
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/index.html"),
        editor: resolve(__dirname, "src/editor.html"),
      },
    },
  },
  publicDir: "../static",
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
})
