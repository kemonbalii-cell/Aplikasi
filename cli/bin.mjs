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

// Resolve tsx relative to THIS package's node_modules
// (works whether installed globally or locally)
const req = createRequire(pathToFileURL(join(root, 'package.json')).href);

let tsxEsmPath;
try {
  tsxEsmPath = req.resolve('tsx/esm/api');
} catch {
  console.error([
    '',
    '  ERROR: tsx not found in node_modules.',
    '  Fix: cd into the Aplikasi folder and run:',
    '    npm install',
    '    npm install -g .',
    '',
  ].join('\n'));
  process.exit(1);
}

// Dynamically import tsx/esm/api and register TypeScript loader
const { register } = await import(pathToFileURL(tsxEsmPath).href);
register();

// Now import the TypeScript CLI — works because tsx is registered
await import(pathToFileURL(join(__dirname, 'index.ts')).href);
