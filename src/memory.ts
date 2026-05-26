import type { MemoryEntry, MemoryLayer } from './types';

const STORAGE_KEY = 'astra_memory';
const MAX_PER_LAYER: Record<MemoryLayer, number> = {
  session: 50,
  project: 100,
  global: 200,
  strategy: 50,
  tool: 100,
  knowledge: 500,
};

function load(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(entries: MemoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full — evict least-important
    const pruned = [...entries].sort((a, b) => a.importance - b.importance).slice(50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  }
}

export function getMemories(layer?: MemoryLayer, sessionId?: string): MemoryEntry[] {
  const all = load();
  return all.filter((m) => {
    if (layer && m.layer !== layer) return false;
    if (sessionId && m.layer === 'session' && m.sessionId !== sessionId) return false;
    return true;
  }).sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt);
}

export function addMemory(
  layer: MemoryLayer,
  key: string,
  content: string,
  importance = 5,
  tags: string[] = [],
  sessionId?: string,
): MemoryEntry {
  const entries = load();

  // update if key exists in same layer
  const existing = entries.find((m) => m.key === key && m.layer === layer);
  if (existing) {
    existing.content = content;
    existing.importance = Math.max(existing.importance, importance);
    existing.updatedAt = Date.now();
    existing.accessCount++;
    existing.tags = [...new Set([...existing.tags, ...tags])];
    save(entries);
    return existing;
  }

  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    layer,
    key,
    content,
    importance,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accessCount: 0,
    tags,
    sessionId,
  };

  const layerEntries = entries.filter((m) => m.layer === layer);
  const max = MAX_PER_LAYER[layer];
  if (layerEntries.length >= max) {
    // evict lowest importance in this layer
    const minImportance = Math.min(...layerEntries.map((m) => m.importance));
    const evict = layerEntries.find((m) => m.importance === minImportance);
    if (evict) {
      const idx = entries.findIndex((m) => m.id === evict.id);
      entries.splice(idx, 1);
    }
  }

  entries.push(entry);
  save(entries);
  return entry;
}

export function updateMemory(id: string, patch: Partial<MemoryEntry>): void {
  const entries = load();
  const idx = entries.findIndex((m) => m.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...patch, updatedAt: Date.now() };
    save(entries);
  }
}

export function deleteMemory(id: string): void {
  const entries = load().filter((m) => m.id !== id);
  save(entries);
}

export function searchMemory(query: string, limit = 10): MemoryEntry[] {
  const q = query.toLowerCase();
  return load()
    .filter((m) => {
      const text = `${m.key} ${m.content} ${m.tags.join(' ')}`.toLowerCase();
      return q.split(/\s+/).some((term) => text.includes(term));
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
}

export function clearSessionMemory(sessionId: string): void {
  const entries = load().filter((m) => !(m.layer === 'session' && m.sessionId === sessionId));
  save(entries);
}

export function getMemoryStats(): Record<MemoryLayer, number> {
  const all = load();
  const layers: MemoryLayer[] = ['session', 'project', 'global', 'strategy', 'tool', 'knowledge'];
  return Object.fromEntries(
    layers.map((l) => [l, all.filter((m) => m.layer === l).length]),
  ) as Record<MemoryLayer, number>;
}

export function exportMemory(): string {
  return JSON.stringify(load(), null, 2);
}

export function importMemory(json: string): number {
  const parsed = JSON.parse(json) as MemoryEntry[];
  const existing = load();
  const existingIds = new Set(existing.map((m) => m.id));
  const newEntries = parsed.filter((m) => !existingIds.has(m.id));
  save([...existing, ...newEntries]);
  return newEntries.length;
}
