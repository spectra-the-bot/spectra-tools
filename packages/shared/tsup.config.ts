import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/middleware/index.ts',
    'src/telemetry/index.ts',
    'src/utils/index.ts',
    'src/testing/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
});
