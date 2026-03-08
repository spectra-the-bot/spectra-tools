import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tx-shared',
    environment: 'node',
    globals: false,
  },
});
