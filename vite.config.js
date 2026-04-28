import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: './src/lib/tianai-captcha.js',
      name: 'Tianai Captcha JS SDK',
      fileName: 'tianai-captcha'
    }
  }
})