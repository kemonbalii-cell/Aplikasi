#!/usr/bin/env node
// Build CLI and Gateway to standalone JS bundles (no tsx needed at runtime)
import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

await mkdir('dist-cli', { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  minify: false,
  // No banner — bin wrappers call `node` directly
  external: [
    'fsevents',
    'vite', '@vitejs/plugin-react', '@tailwindcss/vite',
  ],
};

console.log('Building CLI...');
await build({
  ...shared,
  entryPoints: ['cli/index.ts'],
  outfile: 'dist-cli/cli.mjs',
});

console.log('Building Gateway...');
await build({
  ...shared,
  entryPoints: ['server/index.ts'],
  outfile: 'dist-cli/gateway.mjs',
});

console.log('✓ Built → dist-cli/cli.mjs and dist-cli/gateway.mjs');
