import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'etherscan',
    environment: 'node',
  },
});
