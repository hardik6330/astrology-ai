import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // setup.js injects the minimum env vars the app validates at import time,
    // before any test module (and thus envConfig) is evaluated.
    setupFiles: ['./tests/setup.js'],
    testTimeout: 10_000,
  },
});
