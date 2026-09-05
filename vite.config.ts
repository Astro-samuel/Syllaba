/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths (not '/assets/...') -- required for the packaged
  // Electron app, which loads index.html via file:// where an absolute path
  // resolves to the drive root instead of the app folder and silently fails
  // to load the script/css, producing a blank white window. Relative paths
  // work identically on the hosted web build (served from the site root).
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
