#!/usr/bin/env node
// Entry point wrapper — resolves tsx and runs the CLI
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Find tsx: local node_modules first, then global
const require = createRequire(import.meta.url);
let tsxBin;
try {
  tsxBin = require.resolve('.bin/tsx', { paths: [root] });
} catch {
  tsxBin = 'tsx'; // fallback to global tsx
}

const child = spawn(
  tsxBin,
  [join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', cwd: root }
);

child.on('exit', (code) => process.exit(code ?? 0));
