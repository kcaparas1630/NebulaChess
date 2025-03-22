import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // Copy manifest
        fs.copyFileSync('manifest.json', 'dist/manifest.json');
       
        // Copy index.html
        fs.copyFileSync('index.html', 'dist/index.html');
       
        // Create icons directory
        if (!fs.existsSync('dist/icons')) {
          fs.mkdirSync('dist/icons', { recursive: true });
        }
       
        // Copy icons
        fs.copyFileSync('public/icons/icon16.png', 'dist/icons/icon16.png');
        fs.copyFileSync('public/icons/icon48.png', 'dist/icons/icon48.png');
        fs.copyFileSync('public/icons/icon128.png', 'dist/icons/icon128.png');
      }
    }
  ],
  build: {
    sourcemap: true, // Enable source maps for easier debugging
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/services/background.ts"),
        contentScript: resolve(__dirname, "src/services/contentScript.ts"),
        sidebar: resolve(__dirname, "src/main.tsx"),
        popup: resolve(__dirname, "src/popup.ts")
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'vendor': ['axios']
        }
      },
    },
    outDir: 'dist',
    copyPublicDir: true
  }
});
