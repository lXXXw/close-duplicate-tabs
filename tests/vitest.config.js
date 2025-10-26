import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@ext': path.resolve(__dirname, '../extension'),
      '@utils': path.resolve(__dirname, '../extension/utils'),
    },
  },
});
