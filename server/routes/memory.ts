// /v1/memory — persistent memory CRUD
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const memoryRouter = Router();

const DATA_DIR = path.join(process.env.HOME || '~', '.astra');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');

interface MemEntry {
  id: string;
  layer: string;
  key: string;
  content: string;
  importance: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  sessionId?: string;
}

function readMemory(): MemEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch { return []; }
}

function writeMemory(entries: MemEntry[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

// GET /v1/memory — list all or search
memoryRouter.get('/', (req, res) => {
  const { q, layer, limit = '20' } = req.query as Record<string, string>;
  let entries = readMemory();

  if (layer) entries = entries.filter((e) => e.layer === layer);
  if (q) {
    const query = q.toLowerCase();
    entries = entries.filter((e) =>
      `${e.key} ${e.content} ${e.tags.join(' ')}`.toLowerCase().includes(query),
    );
  }
  entries = entries.sort((a, b) => b.importance - a.importance).slice(0, parseInt(limit));
  res.json({ entries, total: entries.length });
});

// POST /v1/memory — create/update
memoryRouter.post('/', (req, res) => {
  const { layer = 'global', key, content, importance = 5, tags = [], sessionId } = req.body;
  if (!key || !content) { res.status(400).json({ error: 'key and content required' }); return; }

  const entries = readMemory();
  const existing = entries.find((e) => e.key === key && e.layer === layer);

  if (existing) {
    existing.content = content;
    existing.importance = Math.max(existing.importance, importance);
    existing.tags = [...new Set([...existing.tags, ...tags])];
    existing.updatedAt = Date.now();
    existing.accessCount++;
    writeMemory(entries);
    res.json(existing);
    return;
  }

  const entry: MemEntry = {
    id: crypto.randomUUID(),
    layer, key, content, importance, tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accessCount: 0,
    sessionId,
  };
  entries.push(entry);
  writeMemory(entries);
  res.json(entry);
});

// DELETE /v1/memory/:id
memoryRouter.delete('/:id', (req, res) => {
  const entries = readMemory().filter((e) => e.id !== req.params.id);
  writeMemory(entries);
  res.json({ ok: true });
});

// GET /v1/memory/stats
memoryRouter.get('/stats', (_req, res) => {
  const entries = readMemory();
  const layers = ['session', 'project', 'global', 'strategy', 'tool', 'knowledge'];
  const stats = Object.fromEntries(
    layers.map((l) => [l, entries.filter((e) => e.layer === l).length]),
  );
  res.json({ total: entries.length, byLayer: stats });
});
