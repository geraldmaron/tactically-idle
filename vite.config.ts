import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { input: { app: 'index.html', harness: 'harness.html', locations: 'locations.html', story: 'story.html' } },
  },
  // Geometry/route sweeps are CPU-heavy. Bound concurrency so ordinary 5s tests
  // don't time out merely because another file is exploring hundreds of layouts.
  test: { environment: 'node', include: ['src/**/*.test.ts'], maxWorkers: 2 },
});
