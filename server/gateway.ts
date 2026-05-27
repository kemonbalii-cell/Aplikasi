// ─── Provider Gateway — routes requests to the right AI provider ─────────────

import type { HermesConfig } from './index.js';
import type { Response } from 'express';

export type GatewayProvider = 'claude' | 'openai' | 'google' | 'ollama';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface GatewayRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: object[];
  system?: string;
}

export interface GatewayChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'usage' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolId?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

// ─── Provider detection ───────────────────────────────────────────────────────

export function detectProvider(model: string): GatewayProvider {
  if (model.startsWith('claude')) return 'claude';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  return 'ollama';
}

// ─── Claude ──────────────────────────────────────────────────────────────────

async function* streamClaude(
  req: GatewayRequest,
  apiKey: string,
): AsyncGenerator<GatewayChunk> {
  const { model, messages, temperature, max_tokens, tools } = req;

  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: max_tokens || 4096,
    temperature: temperature ?? 0.7,
    stream: true,
  };
  if (systemMsg) body.system = systemMsg.content;
  if (tools?.length) body.tools = tools;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    yield { type: 'error', error: `Claude ${resp.status}: ${txt}` };
    return;
  }

  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let toolName = '', toolId = '', toolArgs = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
          toolId = ev.content_block.id;
          toolName = ev.content_block.name;
          toolArgs = '';
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'text_delta') yield { type: 'text', content: ev.delta.text };
          else if (ev.delta?.type === 'input_json_delta') toolArgs += ev.delta.partial_json;
          else if (ev.delta?.type === 'thinking_delta') yield { type: 'thinking', content: ev.delta.thinking };
        } else if (ev.type === 'content_block_stop' && toolName) {
          let inp: Record<string, unknown> = {};
          try { inp = JSON.parse(toolArgs); } catch {}
          yield { type: 'tool_use', toolName, toolId, toolInput: inp };
          toolName = '';
        } else if (ev.type === 'message_start') {
          yield { type: 'usage', inputTokens: ev.message?.usage?.input_tokens || 0, outputTokens: 0 };
        } else if (ev.type === 'message_delta') {
          yield { type: 'usage', inputTokens: 0, outputTokens: ev.usage?.output_tokens || 0 };
        }
      } catch {}
    }
  }
  yield { type: 'done' };
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function* streamOpenAI(
  req: GatewayRequest,
  apiKey: string,
  baseUrl = 'https://api.openai.com',
): AsyncGenerator<GatewayChunk> {
  const { model, messages, temperature, max_tokens, tools } = req;

  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: max_tokens || 4096,
    temperature: temperature ?? 0.7,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (tools?.length) {
    body.tools = (tools as Array<Record<string, unknown>>).map((t) => ({
      type: 'function',
      function: t,
    }));
  }

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    yield { type: 'error', error: `OpenAI ${resp.status}: ${txt}` };
    return;
  }

  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const toolAccum: Record<string, { name: string; args: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.usage) yield { type: 'usage', inputTokens: ev.usage.prompt_tokens, outputTokens: ev.usage.completion_tokens };
        const delta = ev.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) yield { type: 'text', content: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = String(tc.index);
            if (!toolAccum[idx]) toolAccum[idx] = { name: '', args: '' };
            if (tc.function?.name) toolAccum[idx].name += tc.function.name;
            if (tc.function?.arguments) toolAccum[idx].args += tc.function.arguments;
          }
        }
      } catch {}
    }
  }
  for (const acc of Object.values(toolAccum)) {
    let inp: Record<string, unknown> = {};
    try { inp = JSON.parse(acc.args); } catch {}
    yield { type: 'tool_use', toolName: acc.name, toolId: crypto.randomUUID(), toolInput: inp };
  }
  yield { type: 'done' };
}

// ─── Ollama ──────────────────────────────────────────────────────────────────

async function* streamOllama(
  req: GatewayRequest,
  baseUrl: string,
): AsyncGenerator<GatewayChunk> {
  const { model, messages, temperature } = req;
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, options: { temperature: temperature ?? 0.7 } }),
  });
  if (!resp.ok) { yield { type: 'error', error: `Ollama ${resp.status}` }; return; }

  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.message?.content) yield { type: 'text', content: ev.message.content };
        if (ev.done && ev.eval_count) yield { type: 'usage', inputTokens: 0, outputTokens: ev.eval_count };
      } catch {}
    }
  }
  yield { type: 'done' };
}

// ─── Google ──────────────────────────────────────────────────────────────────

async function* streamGoogle(
  req: GatewayRequest,
  apiKey: string,
): AsyncGenerator<GatewayChunk> {
  const { model, messages, temperature, max_tokens } = req;
  const sysMsg = messages.find((m) => m.role === 'system')?.content;
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const body: Record<string, unknown> = {
    contents: chatMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: temperature ?? 0.7, maxOutputTokens: max_tokens || 4096 },
  };
  if (sysMsg) body.systemInstruction = { parts: [{ text: sysMsg }] };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { const t = await resp.text(); yield { type: 'error', error: `Gemini ${resp.status}: ${t}` }; return; }

  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        const text = ev.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield { type: 'text', content: text };
        const usage = ev.usageMetadata;
        if (usage) yield { type: 'usage', inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0 };
      } catch {}
    }
  }
  yield { type: 'done' };
}

// ─── Unified stream ──────────────────────────────────────────────────────────

export async function* streamGateway(
  req: GatewayRequest,
  config: HermesConfig,
): AsyncGenerator<GatewayChunk> {
  const provider = detectProvider(req.model);

  if (provider === 'claude') {
    const key = config.providers.claude?.apiKey;
    if (!key) { yield { type: 'error', error: 'Claude API key not configured. Run: astra config --claude-key <key>' }; return; }
    yield* streamClaude(req, key);
  } else if (provider === 'openai') {
    const key = config.providers.openai?.apiKey;
    if (!key) { yield { type: 'error', error: 'OpenAI API key not configured.' }; return; }
    yield* streamOpenAI(req, key);
  } else if (provider === 'google') {
    const key = config.providers.google?.apiKey;
    if (!key) { yield { type: 'error', error: 'Google API key not configured.' }; return; }
    yield* streamGoogle(req, key);
  } else {
    const baseUrl = config.providers.ollama?.baseUrl || 'http://localhost:11434';
    yield* streamOllama(req, baseUrl);
  }
}

// ─── SSE helper ──────────────────────────────────────────────────────────────

export function startSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sendSSE(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function endSSE(res: Response): void {
  res.write('data: [DONE]\n\n');
  res.end();
}
