import type { Tool, ToolContext, ToolExecutionResult } from './types';
import { addMemory, searchMemory, getMemories, deleteMemory } from './memory';

function ok(output: string, data?: unknown, time = 0): ToolExecutionResult {
  return { success: true, output, data, executionTime: time };
}
function err(error: string, time = 0): ToolExecutionResult {
  return { success: false, output: `Error: ${error}`, error, executionTime: time };
}

const TOOLS: Tool[] = [
  // ─── Date/Time ───────────────────────────────────────────────────────────
  {
    name: 'get_datetime',
    displayName: 'Date & Time',
    description: 'Get the current date, time, and timezone information.',
    category: 'system',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Format: "full", "date", "time", "iso"', enum: ['full', 'date', 'time', 'iso'] },
      },
      required: [],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const fmt = (input.format as string) || 'full';
      const now = new Date();
      const result = {
        full: now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' }),
        date: now.toLocaleDateString('en-US', { dateStyle: 'full' }),
        time: now.toLocaleTimeString('en-US', { timeStyle: 'long' }),
        iso: now.toISOString(),
      }[fmt] ?? now.toISOString();
      return ok(result, { iso: now.toISOString(), unix: now.getTime() });
    },
  },

  // ─── Calculator ──────────────────────────────────────────────────────────
  {
    name: 'calculate',
    displayName: 'Calculator',
    description: 'Evaluate a safe mathematical expression. Supports: +,-,*,/,**,sqrt,abs,sin,cos,tan,log,floor,ceil,round,PI,E.',
    category: 'data',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression to evaluate, e.g. "sqrt(2) * PI"' },
      },
      required: ['expression'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const expr = String(input.expression);
      // whitelist safe chars
      if (/[^0-9\s.+\-*/%^().,a-zA-Z_]/.test(expr)) {
        return err('Expression contains invalid characters.');
      }
      try {
        const safeExpr = expr
          .replace(/\bsqrt\b/g, 'Math.sqrt')
          .replace(/\babs\b/g, 'Math.abs')
          .replace(/\bsin\b/g, 'Math.sin')
          .replace(/\bcos\b/g, 'Math.cos')
          .replace(/\btan\b/g, 'Math.tan')
          .replace(/\blog\b/g, 'Math.log')
          .replace(/\bfloor\b/g, 'Math.floor')
          .replace(/\bceil\b/g, 'Math.ceil')
          .replace(/\bround\b/g, 'Math.round')
          .replace(/\bPI\b/g, 'Math.PI')
          .replace(/\bE\b/g, 'Math.E')
          .replace(/\^/g, '**');
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${safeExpr})`)();
        return ok(String(result), { expression: expr, result });
      } catch (e) {
        return err(`Invalid expression: ${(e as Error).message}`);
      }
    },
  },

  // ─── Web Fetch ───────────────────────────────────────────────────────────
  {
    name: 'fetch_url',
    displayName: 'Fetch URL',
    description: 'Fetch text content from a URL (CORS-permitting). Use for reading documentation, APIs, or web pages.',
    category: 'search',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to fetch' },
        selector: { type: 'string', description: 'Optional CSS selector to extract specific element text' },
      },
      required: ['url'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const t0 = Date.now();
      try {
        const resp = await fetch(String(input.url), { signal: AbortSignal.timeout(10_000) });
        if (!resp.ok) return err(`HTTP ${resp.status}`, Date.now() - t0);
        const text = await resp.text();
        const output = text.slice(0, 4000) + (text.length > 4000 ? '\n…(truncated)' : '');
        return ok(output, undefined, Date.now() - t0);
      } catch (e) {
        return err((e as Error).message, Date.now() - t0);
      }
    },
  },

  // ─── Memory: Write ───────────────────────────────────────────────────────
  {
    name: 'memory_write',
    displayName: 'Write Memory',
    description: 'Save important information to persistent memory for future reference.',
    category: 'memory',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique key for this memory' },
        content: { type: 'string', description: 'The information to store' },
        layer: {
          type: 'string',
          description: 'Memory layer: session, project, global, strategy, tool, knowledge',
          enum: ['session', 'project', 'global', 'strategy', 'tool', 'knowledge'],
        },
        importance: { type: 'string', description: 'Importance 1-10 (default 5)' },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['key', 'content'],
    },
    async execute(input, ctx: ToolContext): Promise<ToolExecutionResult> {
      const entry = addMemory(
        (input.layer as string || 'project') as import('./types').MemoryLayer,
        String(input.key),
        String(input.content),
        Number(input.importance) || 5,
        String(input.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        ctx.sessionId,
      );
      return ok(`Saved to ${entry.layer} memory with key "${entry.key}"`);
    },
  },

  // ─── Memory: Read ────────────────────────────────────────────────────────
  {
    name: 'memory_read',
    displayName: 'Read Memory',
    description: 'Search and retrieve information from memory.',
    category: 'memory',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to find relevant memories' },
        layer: { type: 'string', description: 'Filter by layer (optional)', enum: ['session', 'project', 'global', 'strategy', 'tool', 'knowledge'] },
        limit: { type: 'string', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
    async execute(input, ctx: ToolContext): Promise<ToolExecutionResult> {
      const results = input.layer
        ? getMemories(input.layer as import('./types').MemoryLayer, ctx.sessionId)
            .filter((m) => {
              const q = String(input.query).toLowerCase();
              return `${m.key} ${m.content}`.toLowerCase().includes(q);
            })
            .slice(0, Number(input.limit) || 5)
        : searchMemory(String(input.query), Number(input.limit) || 5);

      if (!results.length) return ok('No memories found matching your query.');
      const formatted = results.map((m) =>
        `[${m.layer}:${m.key}] (importance: ${m.importance})\n${m.content}`,
      ).join('\n\n---\n\n');
      return ok(formatted, results);
    },
  },

  // ─── Memory: Delete ──────────────────────────────────────────────────────
  {
    name: 'memory_delete',
    displayName: 'Delete Memory',
    description: 'Delete a specific memory entry by its ID.',
    category: 'memory',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory entry ID to delete' },
      },
      required: ['id'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      deleteMemory(String(input.id));
      return ok('Memory entry deleted.');
    },
  },

  // ─── Code Runner ─────────────────────────────────────────────────────────
  {
    name: 'run_js',
    displayName: 'Run JavaScript',
    description: 'Execute a JavaScript snippet in a sandboxed environment. Returns console output and result.',
    category: 'code',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['code'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const t0 = Date.now();
      const logs: string[] = [];
      try {
        const sandbox = {
          console: {
            log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
            error: (...args: unknown[]) => logs.push('ERROR: ' + args.map(String).join(' ')),
            warn: (...args: unknown[]) => logs.push('WARN: ' + args.map(String).join(' ')),
          },
          Math, JSON, Date, Array, Object, String, Number, Boolean, parseInt, parseFloat,
          setTimeout: undefined, setInterval: undefined, fetch: undefined, XMLHttpRequest: undefined,
        };
        // eslint-disable-next-line no-new-func
        const fn = new Function(...Object.keys(sandbox), `"use strict";\n${String(input.code)}`);
        const result = fn(...Object.values(sandbox));
        const output = [
          ...logs,
          result !== undefined ? `→ ${JSON.stringify(result, null, 2)}` : '',
        ].filter(Boolean).join('\n');
        return ok(output || '(no output)', result, Date.now() - t0);
      } catch (e) {
        return err((e as Error).message, Date.now() - t0);
      }
    },
  },

  // ─── Text Analysis ───────────────────────────────────────────────────────
  {
    name: 'analyze_text',
    displayName: 'Analyze Text',
    description: 'Analyze text: count words/chars/sentences, extract top keywords, detect language hints.',
    category: 'data',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
      },
      required: ['text'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const text = String(input.text);
      const words = text.trim().split(/\s+/).filter(Boolean);
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const chars = text.length;
      const freq: Record<string, number> = {};
      words.forEach((w) => {
        const k = w.toLowerCase().replace(/[^a-z]/g, '');
        if (k.length > 3) freq[k] = (freq[k] || 0) + 1;
      });
      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([w, n]) => `${w}(${n})`);

      const output = [
        `Words: ${words.length}`,
        `Characters: ${chars}`,
        `Sentences: ${sentences.length}`,
        `Avg word length: ${(words.reduce((s, w) => s + w.length, 0) / (words.length || 1)).toFixed(1)}`,
        `Top keywords: ${topKeywords.join(', ')}`,
      ].join('\n');
      return ok(output, { words: words.length, chars, sentences: sentences.length, topKeywords });
    },
  },

  // ─── UUID Generator ──────────────────────────────────────────────────────
  {
    name: 'generate_uuid',
    displayName: 'Generate UUID',
    description: 'Generate one or more UUIDs.',
    category: 'data',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'string', description: 'Number of UUIDs to generate (1-10, default 1)' },
      },
      required: [],
    },
    async execute(input): Promise<ToolExecutionResult> {
      const count = Math.min(10, Math.max(1, Number(input.count) || 1));
      const ids = Array.from({ length: count }, () => crypto.randomUUID());
      return ok(ids.join('\n'), ids);
    },
  },

  // ─── JSON Formatter ──────────────────────────────────────────────────────
  {
    name: 'format_json',
    displayName: 'Format JSON',
    description: 'Parse and pretty-print JSON, or minify it. Also validates JSON structure.',
    category: 'data',
    isBuiltin: true,
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'JSON string to format' },
        mode: { type: 'string', description: '"pretty" (default) or "minify"', enum: ['pretty', 'minify'] },
      },
      required: ['json'],
    },
    async execute(input): Promise<ToolExecutionResult> {
      try {
        const parsed = JSON.parse(String(input.json));
        const output = input.mode === 'minify'
          ? JSON.stringify(parsed)
          : JSON.stringify(parsed, null, 2);
        return ok(output, parsed);
      } catch (e) {
        return err(`Invalid JSON: ${(e as Error).message}`);
      }
    },
  },
];

export function getTools(): Tool[] {
  return TOOLS;
}

export function getTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function getToolsForProvider(): object[] {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolExecutionResult> {
  const tool = getTool(name);
  if (!tool) return { success: false, output: `Unknown tool: ${name}`, error: `Unknown tool: ${name}`, executionTime: 0 };
  return tool.execute(input, ctx);
}
