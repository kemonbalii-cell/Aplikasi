// ─── ASTRA HERMES ULTRA — Backend Gateway Server ────────────────────────────
// OpenAI-compatible API gateway routing to Claude, OpenAI, Gemini, Ollama
// Runs on http://localhost:4000

import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatRouter } from './routes/chat.js';
import { memoryRouter } from './routes/memory.js';
import { toolsRouter } from './routes/tools.js';
import { agentsRouter } from './routes/agents.js';
import { modelsRouter } from './routes/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.HERMES_PORT || '4000', 10);

// ─── Load config ─────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(process.env.HOME || '~', '.astra', 'config.json');

export interface HermesConfig {
  providers: {
    claude?:  { apiKey: string };
    openai?:  { apiKey: string };
    google?:  { apiKey: string };
    ollama?:  { baseUrl: string };
  };
  defaultModel: string;
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableMemory: boolean;
  enableTools: boolean;
  enableAgents: boolean;
  enabledAgents: string[];
}

export function loadConfig(): HermesConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {
    providers: {},
    defaultModel: 'claude-sonnet-4-5',
    defaultProvider: 'claude',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: `You are ASTRA HERMES ULTRA — an advanced autonomous AI engineering assistant.
You are highly capable, proactive, goal-driven, transparent, tool-oriented, and safe by default.
Use tools when appropriate. Write clean, well-explained code. Be thorough but concise.`,
    enableMemory: true,
    enableTools: true,
    enableAgents: true,
    enabledAgents: ['planner', 'executor', 'memory', 'researcher'],
  };
}

export function saveConfig(config: HermesConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS for web UI
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// Request logging
app.use((req, _res, next) => {
  const ts = new Date().toISOString().slice(11, 23);
  process.stdout.write(`\x1b[90m[${ts}] ${req.method} ${req.path}\x1b[0m\n`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/v1/chat', chatRouter);
app.use('/v1/memory', memoryRouter);
app.use('/v1/tools', toolsRouter);
app.use('/v1/agents', agentsRouter);
app.use('/v1/models', modelsRouter);

// Health check
app.get('/health', (_req, res) => {
  const config = loadConfig();
  res.json({
    status: 'ok',
    version: '1.0.0',
    name: 'ASTRA HERMES ULTRA Gateway',
    defaultModel: config.defaultModel,
    providers: {
      claude:  !!config.providers.claude?.apiKey,
      openai:  !!config.providers.openai?.apiKey,
      google:  !!config.providers.google?.apiKey,
      ollama:  !!config.providers.ollama?.baseUrl,
    },
    uptime: process.uptime(),
  });
});

// Config endpoint
app.get('/v1/config', (_req, res) => res.json(loadConfig()));
app.put('/v1/config', (req, res) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  saveConfig(updated);
  res.json({ ok: true, config: updated });
});

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`\x1b[35m
  ╔══════════════════════════════════════════╗
  ║   ASTRA HERMES ULTRA — Gateway v1.0.0   ║
  ╚══════════════════════════════════════════╝\x1b[0m`);
  console.log(`\x1b[32m  ✓ Gateway running on http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[32m  ✓ Health: http://localhost:${PORT}/health\x1b[0m`);
  console.log(`\x1b[32m  ✓ Chat:   POST http://localhost:${PORT}/v1/chat/completions\x1b[0m`);
  console.log(`\x1b[32m  ✓ Models: GET  http://localhost:${PORT}/v1/models\x1b[0m`);

  const cfg = loadConfig();
  const missing = [];
  if (!cfg.providers.claude?.apiKey) missing.push('claude');
  if (!cfg.providers.openai?.apiKey) missing.push('openai');
  if (!cfg.providers.google?.apiKey) missing.push('google');
  if (missing.length) {
    console.log(`\x1b[33m  ⚠ No keys for: ${missing.join(', ')} — run: npx tsx cli/index.ts config\x1b[0m`);
  }
  console.log('');
});

export { app, server };
