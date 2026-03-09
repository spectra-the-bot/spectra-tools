import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    splitting: false,
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: [
      'src/index.ts',
      'src/renderer.ts',
      'src/qa.ts',
      'src/spec.schema.ts',
      'src/publish/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: false,
    splitting: false,
    target: 'node20',
  },
]);
