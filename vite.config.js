import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
  },
  build: {
    lib: {
      entry: './src/lib/tianai-captcha.js',
      name: 'Tianai Captcha JS SDK',
      fileName: 'tianai-captcha'
    }
  }
})

