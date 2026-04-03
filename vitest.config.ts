import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'desktop'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'desktop',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/**',
      ],
    },
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
});
