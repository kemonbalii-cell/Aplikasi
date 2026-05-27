#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const require = createRequire(import.meta.url);
let tsxBin;
try {
  tsxBin = require.resolve('.bin/tsx', { paths: [root] });
} catch {
  tsxBin = 'tsx';
}

const child = spawn(
  tsxBin,
  [join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', cwd: root }
);

child.on('exit', (code) => process.exit(code ?? 0));
