import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Preview tooling assigns a free port through PORT; plain `npm run dev` keeps 5173.
  server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT },
  build: {
    rollupOptions: { input: { app: 'index.html', harness: 'harness.html', locations: 'locations.html', story: 'story.html' } },
  },
  // Geometry/route sweeps are CPU-heavy. Bound concurrency so ordinary 5s tests
  // don't time out merely because another file is exploring hundreds of layouts.
  test: { environment: 'node', include: ['src/**/*.test.ts'], maxWorkers: 2 },
});
