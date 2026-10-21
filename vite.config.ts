/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is set from the environment when deploying to GitHub Pages
// (the site lives at https://<user>.github.io/<repo>/). Locally it is '/'.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
