#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const isWin = process.platform === 'win32';

const child = spawn(
  isWin ? 'tsx.cmd' : 'tsx',
  [join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', cwd: root, shell: isWin }
);

child.on('error', (err) => {
  console.error('Failed to start Gateway. Make sure tsx is installed:\n  npm install -g tsx\n', err.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
