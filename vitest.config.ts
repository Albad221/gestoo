import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/vitest.config.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@gestoo/types': '/Users/aliounebadarambengue/Desktop/dallal/packages/shared-types/src/index.ts',
    },
  },
});
