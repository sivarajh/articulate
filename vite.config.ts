import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base + hash routing: the build runs from any path (GitHub Pages, a subfolder, file server).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
