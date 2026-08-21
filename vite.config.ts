import react from '@vitejs/plugin-react';
// From `vitest/config`, not from `vite`: it is the same function widened with
// the `test` key, which is what lets one file configure the dev server, the
// build and the test run without them drifting apart.
import { defineConfig } from 'vitest/config';

/**
 * One config for the dev server, the build and the tests.
 *
 * The API is reached through a proxy in development rather than through an
 * absolute URL, so the browser makes same-origin requests and the app never
 * needs CORS or a base URL baked into it. In production the SPA is served from
 * S3 behind CloudFront, which routes `/api` to the backend the same way — the
 * code cannot tell the two apart, which is the point.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.CUBEFORGE_API_ORIGIN ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    // The runner stubs stylesheet imports by default, which also empties the
    // `?raw` ones — and a test that reads the design tokens then asserts
    // against an empty string, in silence. Nothing else here imports CSS.
    css: true,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Both roots, because a test file that is silently never collected is
    // worse than no test at all — it reads as coverage. The harness lives in
    // `test/`, and the first version of this pattern named only `src/`.
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Comfortably above Testing Library's `asyncUtilTimeout` (`test/setup.ts`).
    // With the two equal, a query that never matches exhausts the *test* before
    // it exhausts itself, and the report is "timed out in 5000ms" rather than
    // the element it could not find and the ones it found instead.
    testTimeout: 10_000,
  },
});
