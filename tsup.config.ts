import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry - with shebang
  {
    entry: ['src/cli/index.tsx'],
    format: ['esm'],
    outDir: 'dist/cli',
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node18',
    external: ['react', 'ink'],
    banner: {
      js: '#!/usr/bin/env node\n',
    },
  },
  // Library entry - no shebang
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: false,
    sourcemap: true,
    target: 'node18',
    external: ['react', 'ink'],
  },
]);
