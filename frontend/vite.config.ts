import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'node:url';

// The Midnight runtime ships a WASM core (@midnightntwrk/onchain-runtime-v4).
// Vite cannot bundle ESM-integrated WASM natively, so vite-plugin-wasm is required;
// without it the build fails with "ESM integration proposal for Wasm is not supported".
// The wasm plugin emits top-level await, so the build target must be esnext. We do NOT
// use vite-plugin-top-level-await: its swc pass throws "missing field `type`" on this
// bundle, and esnext supports TLA natively anyway.
export default defineConfig({
  plugins: [wasm(), react(), tailwindcss()],
  resolve: {
    alias: { '@contract': fileURLToPath(new URL('../contract', import.meta.url)) },
  },
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
});
