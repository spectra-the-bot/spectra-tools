import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types.ts', 'src/errors.ts', 'src/chain.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
});
