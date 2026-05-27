#!/usr/bin/env node
/**
 * ASTRA HERMES ULTRA — CLI entry point
 * Uses tsx register API (same process, no subprocess, no PATH issues)
 * Works on Windows, macOS, Linux — Node.js 18+
 */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Build candidate locations to search for tsx (local first, then global)
function candidateRoots() {
  const roots = [root];

  // Windows: %APPDATA%\npm
  if (process.env.APPDATA) {
    roots.push(join(process.env.APPDATA, 'npm'));
  }
  // Unix global prefixes
  if (process.env.HOME) {
    roots.push(join(process.env.HOME, '.npm-global'));
    roots.push('/usr/local');
    roots.push('/usr');
  }
  return roots;
}

let tsxEsmPath;
for (const candidate of candidateRoots()) {
  try {
    const fakeManifest = pathToFileURL(join(candidate, 'package.json')).href;
    const r = createRequire(fakeManifest);
    tsxEsmPath = r.resolve('tsx/esm/api');
    break;
  } catch {
    // try next location
  }
}

if (!tsxEsmPath) {
  console.error([
    '',
    '  ERROR: tsx not found.',
    '  Fix: cd into the Aplikasi folder and run:',
    '    npm install',
    '  or install tsx globally:',
    '    npm install -g tsx',
    '',
  ].join('\n'));
  process.exit(1);
}

// Register TypeScript loader in this process (no subprocess needed)
const { register } = await import(pathToFileURL(tsxEsmPath).href);
register();

// Now import the TypeScript CLI — works because tsx is registered
await import(pathToFileURL(join(__dirname, 'index.ts')).href);
