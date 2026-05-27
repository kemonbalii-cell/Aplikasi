// /v1/tools — server-side tool execution (has real fs/shell access)
import { Router } from 'express';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export const toolsRouter = Router();

// GET /v1/tools — list available tools
toolsRouter.get('/', (_req, res) => {
  res.json({
    tools: [
      { name: 'read_file',    description: 'Read a file from the filesystem',      category: 'file'   },
      { name: 'write_file',   description: 'Write content to a file',              category: 'file'   },
      { name: 'list_dir',     description: 'List directory contents',              category: 'file'   },
      { name: 'run_shell',    description: 'Execute a shell command',              category: 'system' },
      { name: 'git_status',   description: 'Get git status of a repository',      category: 'system' },
      { name: 'git_log',      description: 'Get recent git commits',               category: 'system' },
      { name: 'calculate',    description: 'Evaluate a math expression',           category: 'data'   },
      { name: 'get_datetime', description: 'Get current date and time',           category: 'system' },
    ],
  });
});

// POST /v1/tools/execute
toolsRouter.post('/execute', async (req, res) => {
  const { tool, input = {} } = req.body;
  const t0 = Date.now();

  try {
    let result: unknown;

    switch (tool) {
      case 'read_file': {
        const fp = path.resolve(String(input.path || ''));
        if (!fs.existsSync(fp)) throw new Error(`File not found: ${fp}`);
        const content = fs.readFileSync(fp, 'utf-8');
        result = content.slice(0, 10_000) + (content.length > 10_000 ? '\n...(truncated)' : '');
        break;
      }

      case 'write_file': {
        const fp = path.resolve(String(input.path || ''));
        const dir = path.dirname(fp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fp, String(input.content || ''));
        result = `Written ${(input.content as string).length} chars to ${fp}`;
        break;
      }

      case 'list_dir': {
        const dir = path.resolve(String(input.path || '.'));
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        result = entries.map((e) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
        break;
      }

      case 'run_shell': {
        const cmd = String(input.command || '');
        const cwd = String(input.cwd || process.cwd());
        const timeout = Math.min(Number(input.timeout) || 10_000, 30_000);

        try {
          result = execSync(cmd, { cwd, timeout, encoding: 'utf-8', maxBuffer: 1_000_000 });
        } catch (e: unknown) {
          const err = e as { stdout?: string; stderr?: string; message: string };
          result = (err.stdout || '') + (err.stderr || '') || err.message;
        }
        break;
      }

      case 'git_status': {
        const cwd = String(input.path || process.cwd());
        result = execSync('git status --short', { cwd, encoding: 'utf-8' });
        break;
      }

      case 'git_log': {
        const cwd = String(input.path || process.cwd());
        const n = Math.min(Number(input.n) || 10, 50);
        result = execSync(`git log --oneline -${n}`, { cwd, encoding: 'utf-8' });
        break;
      }

      case 'calculate': {
        const expr = String(input.expression || '').replace(/[^0-9\s.+\-*/%^().,a-zA-Z_]/g, '');
        const safeExpr = expr
          .replace(/\bsqrt\b/g, 'Math.sqrt').replace(/\babs\b/g, 'Math.abs')
          .replace(/\bsin\b/g, 'Math.sin').replace(/\bcos\b/g, 'Math.cos')
          .replace(/\bPI\b/g, 'Math.PI').replace(/\bE\b/g, 'Math.E')
          .replace(/\^/g, '**');
        // eslint-disable-next-line no-new-func
        result = Function(`"use strict"; return (${safeExpr})`)();
        break;
      }

      case 'get_datetime': {
        result = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
        break;
      }

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    res.json({ success: true, result, executionTime: Date.now() - t0 });
  } catch (e) {
    res.status(200).json({ success: false, error: (e as Error).message, executionTime: Date.now() - t0 });
  }
});
