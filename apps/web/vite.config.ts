import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/raidru/',
  plugins: [react()],
  resolve: {
    alias: {
      '@raidru/shared-types': fileURLToPath(new URL('../../packages/shared-types/src/index.ts', import.meta.url)),
      '@raidru/planner-core': fileURLToPath(new URL('../../packages/planner-core/src/index.ts', import.meta.url)),
      '@raidru/raidplan-core': fileURLToPath(new URL('../../packages/raidplan-core/src/index.ts', import.meta.url))
    }
  },
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
