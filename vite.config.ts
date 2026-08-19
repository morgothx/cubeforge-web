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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
