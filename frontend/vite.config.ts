import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// The frontend imports the contract simulator from ../contract. Node resolves
// that file's own imports relative to contract/, so `@midnight-ntwrk/compact-runtime`
// only resolved if someone had already run `npm install` inside contract/.
// A clean clone doing `cd frontend && npm install && npm run build` failed.
// Resolving it explicitly from the frontend's own node_modules makes build order
// irrelevant.
const runtimeEntry = require.resolve('@midnight-ntwrk/compact-runtime');

// The Midnight runtime ships an ESM-integrated WASM core, which Vite cannot bundle
// natively, hence vite-plugin-wasm and an esnext target. vite-plugin-top-level-await
// is deliberately NOT used: its swc pass throws "missing field `type`" on this bundle
// and esnext handles top-level await natively.
export default defineConfig({
  plugins: [wasm(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@contract': fileURLToPath(new URL('../contract', import.meta.url)),
      '@midnight-ntwrk/compact-runtime': runtimeEntry,
    },
    dedupe: ['@midnight-ntwrk/compact-runtime', 'react', 'react-dom'],
  },
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
});
