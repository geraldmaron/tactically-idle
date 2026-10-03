import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { input: { app: 'index.html', harness: 'harness.html' } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
