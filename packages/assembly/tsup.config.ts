import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
});
