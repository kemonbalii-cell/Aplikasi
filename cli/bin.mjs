#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const ext = isWin ? '.cmd' : '';

// Find tsx: in same package's node_modules, or global PATH
const candidates = [
  join(root, 'node_modules', '.bin', `tsx${ext}`),
  join(root, '..', '.bin', `tsx${ext}`),           // hoisted (npm workspaces)
  join(root, '..', 'tsx', 'dist', 'cli.mjs'),       // tsx package direct
];

let tsxCmd = `tsx${ext}`;           // fallback: rely on PATH
for (const c of candidates) {
  if (existsSync(c)) { tsxCmd = c; break; }
}

const child = spawn(tsxCmd, [join(__dirname, 'index.ts'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  shell: isWin,           // needed on Windows so .cmd resolves correctly
});

child.on('error', () => {
  // Last resort: try node --import tsx/esm
  const child2 = spawn(process.execPath, [
    '--import', 'tsx/esm',
    join(__dirname, 'index.ts'),
    ...process.argv.slice(2),
  ], { stdio: 'inherit', cwd: root });
  child2.on('error', (e) => {
    console.error('\nCould not start ASTRA. Run this first:\n  npm install\n\n' + e.message);
    process.exit(1);
  });
  child2.on('exit', (c) => process.exit(c ?? 0));
});

child.on('exit', (code) => process.exit(code ?? 0));
