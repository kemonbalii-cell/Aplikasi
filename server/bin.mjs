#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const ext = isWin ? '.cmd' : '';

const candidates = [
  join(root, 'node_modules', '.bin', `tsx${ext}`),
  join(root, '..', '.bin', `tsx${ext}`),
];

let tsxCmd = `tsx${ext}`;
for (const c of candidates) {
  if (existsSync(c)) { tsxCmd = c; break; }
}

const child = spawn(tsxCmd, [join(__dirname, 'index.ts'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  shell: isWin,
});

child.on('error', () => {
  const child2 = spawn(process.execPath, [
    '--import', 'tsx/esm',
    join(__dirname, 'index.ts'),
    ...process.argv.slice(2),
  ], { stdio: 'inherit', cwd: root });
  child2.on('error', (e) => {
    console.error('\nCould not start Gateway:\n  npm install\n\n' + e.message);
    process.exit(1);
  });
  child2.on('exit', (c) => process.exit(c ?? 0));
});

child.on('exit', (code) => process.exit(code ?? 0));
