import type { ModelDef, Provider, StreamChunk, SendMessageOptions, ToolCall } from './types';
import { GoogleGenAI } from '@google/genai';

// ─── Model Registry ─────────────────────────────────────────────────────────

export const MODELS: ModelDef[] = [
  // Claude
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'claude', contextWindow: 200_000, inputCostPer1m: 15, outputCostPer1m: 75, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Most capable Claude model' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'claude', contextWindow: 200_000, inputCostPer1m: 3, outputCostPer1m: 15, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Best balance of speed & intelligence' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude', contextWindow: 200_000, inputCostPer1m: 0.8, outputCostPer1m: 4, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Fast and cost-efficient' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128_000, inputCostPer1m: 5, outputCostPer1m: 15, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Most capable GPT model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128_000, inputCostPer1m: 0.15, outputCostPer1m: 0.6, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Small & fast OpenAI model' },
  { id: 'o1', name: 'o1', provider: 'openai', contextWindow: 200_000, inputCostPer1m: 15, outputCostPer1m: 60, supportsTools: false, supportsVision: true, supportsStreaming: false, description: 'Best reasoning model' },
  // Google
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1_000_000, inputCostPer1m: 0.3, outputCostPer1m: 2.5, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Fast Gemini with huge context' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 2_000_000, inputCostPer1m: 3.5, outputCostPer1m: 10.5, supportsTools: true, supportsVision: true, supportsStreaming: true, description: 'Most capable Gemini model' },
  // MiniMax
  { id: 'MiniMax-Text-01', name: 'MiniMax Text-01', provider: 'minimax', contextWindow: 1_000_000, inputCostPer1m: 0.14, outputCostPer1m: 0.55, supportsTools: true, supportsVision: false, supportsStreaming: true, description: 'MiniMax flagship long-context model' },
  { id: 'MiniMax-M1', name: 'MiniMax M1', provider: 'minimax', contextWindow: 1_000_000, inputCostPer1m: 0.3, outputCostPer1m: 1.1, supportsTools: true, supportsVision: false, supportsStreaming: true, description: 'MiniMax reasoning model' },
  { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'minimax', contextWindow: 1_000_000, inputCostPer1m: 0.3, outputCostPer1m: 1.1, supportsTools: true, supportsVision: false, supportsStreaming: true, description: 'MiniMax M2.7 model' },
  // Ollama
  { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', contextWindow: 128_000, inputCostPer1m: 0, outputCostPer1m: 0, supportsTools: false, supportsVision: false, supportsStreaming: true, description: 'Local Llama model (free)' },
  { id: 'mistral', name: 'Mistral 7B', provider: 'ollama', contextWindow: 32_000, inputCostPer1m: 0, outputCostPer1m: 0, supportsTools: false, supportsVision: false, supportsStreaming: true, description: 'Local Mistral model (free)' },
  { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', provider: 'ollama', contextWindow: 128_000, inputCostPer1m: 0, outputCostPer1m: 0, supportsTools: false, supportsVision: false, supportsStreaming: true, description: 'Local coding model (free)' },
];

export function getModelsForProvider(provider: Provider): ModelDef[] {
  return MODELS.filter((m) => m.provider === provider);
}

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function calcCost(model: ModelDef, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * model.inputCostPer1m
    + (outputTokens / 1_000_000) * model.outputCostPer1m;
}

// ─── Claude Provider ────────────────────────────────────────────────────────

async function* streamClaude(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
  const { content, model, systemPrompt, temperature, maxTokens, tools } = opts;
  const apiKey = opts as unknown as { _apiKey: string };  // passed via extra field

  const messages = [{ role: 'user', content }];
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens || 4096,
    temperature: temperature ?? 0.7,
    stream: true,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': (opts as unknown as Record<string, string>)._apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    yield { type: 'error', error: `Claude API error ${resp.status}: ${errText}` };
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let currentToolId = '';
  let currentToolName = '';
  let currentToolInputStr = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInputStr = '';
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text };
            outputTokens += Math.ceil(event.delta.text.length / 4);
          } else if (event.delta?.type === 'input_json_delta') {
            currentToolInputStr += event.delta.partial_json;
          } else if (event.delta?.type === 'thinking_delta') {
            yield { type: 'thinking', content: event.delta.thinking };
          }
        } else if (event.type === 'content_block_stop' && currentToolName) {
          let toolInput: Record<string, unknown> = {};
          try { toolInput = JSON.parse(currentToolInputStr); } catch {}
          const tc: ToolCall = {
            id: currentToolId,
            toolName: currentToolName,
            input: toolInput,
            status: 'running',
            startTime: Date.now(),
          };
          yield { type: 'tool_use', toolCall: tc };
          currentToolName = '';
          currentToolId = '';
          currentToolInputStr = '';
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      } catch {}
    }
  }

  yield { type: 'usage', inputTokens, outputTokens };
  yield { type: 'done' };
}

// ─── OpenAI Provider ────────────────────────────────────────────────────────

async function* streamOpenAI(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
  const { content, model, systemPrompt, temperature, maxTokens, tools } = opts;
  const apiKey = (opts as unknown as Record<string, string>)._apiKey;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens || 4096,
    temperature: temperature ?? 0.7,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    yield { type: 'error', error: `OpenAI error ${resp.status}: ${errText}` };
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCallAccumulators: Record<string, { name: string; args: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.usage) {
          inputTokens = event.usage.prompt_tokens;
          outputTokens = event.usage.completion_tokens;
        }
        const delta = event.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) yield { type: 'text', content: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = String(tc.index);
            if (!toolCallAccumulators[idx]) {
              toolCallAccumulators[idx] = { name: tc.function?.name || '', args: '' };
            }
            if (tc.function?.name) toolCallAccumulators[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccumulators[idx].args += tc.function.arguments;
          }
        }
      } catch {}
    }
  }

  for (const [, acc] of Object.entries(toolCallAccumulators)) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(acc.args); } catch {}
    const tc: ToolCall = {
      id: crypto.randomUUID(),
      toolName: acc.name,
      input,
      status: 'running',
      startTime: Date.now(),
    };
    yield { type: 'tool_use', toolCall: tc };
  }

  yield { type: 'usage', inputTokens, outputTokens };
  yield { type: 'done' };
}

// ─── Ollama Provider ────────────────────────────────────────────────────────

async function* streamOllama(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
  const { content, model, systemPrompt, temperature } = opts;
  const baseUrl = (opts as unknown as Record<string, string>)._baseUrl || 'http://localhost:11434';

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content });

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, options: { temperature: temperature ?? 0.7 } }),
  });

  if (!resp.ok) {
    yield { type: 'error', error: `Ollama error ${resp.status}` };
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.message?.content) {
          yield { type: 'text', content: event.message.content };
          outputTokens += Math.ceil(event.message.content.length / 4);
        }
        if (event.done && event.eval_count) outputTokens = event.eval_count;
      } catch {}
    }
  }

  yield { type: 'usage', inputTokens: 0, outputTokens };
  yield { type: 'done' };
}

// ─── Google Provider ────────────────────────────────────────────────────────

async function* streamGoogle(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
  const { content, model, systemPrompt, temperature, maxTokens } = opts;
  const apiKey = (opts as unknown as Record<string, string>)._apiKey;

  const genAI = new GoogleGenAI({ apiKey });
  const modelId = model.replace('gemini-', 'models/gemini-');

  const config: Record<string, unknown> = {
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxTokens || 4096,
  };
  if (systemPrompt) config.systemInstruction = systemPrompt;

  try {
    const result = await genAI.models.generateContentStream({
      model: model,
      contents: [{ role: 'user', parts: [{ text: content }] }],
      config,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunkAny = chunk as any;
      const text: string = typeof chunkAny.text === 'function' ? chunkAny.text() : (chunkAny.text ?? '');
      if (text) yield { type: 'text', content: text };
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount || 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
      }
    }

    yield { type: 'usage', inputTokens, outputTokens };
    yield { type: 'done' };
  } catch (e) {
    yield { type: 'error', error: (e as Error).message };
  }
}

// ─── MiniMax Provider (OpenAI-compatible) ───────────────────────────────────

async function* streamMiniMax(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
  const { content, model, systemPrompt, temperature, maxTokens } = opts;
  const apiKey = (opts as unknown as Record<string, string>)._apiKey;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content });

  const resp = await fetch('https://api.minimaxi.chat/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens || 4096,
      temperature: temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    yield { type: 'error', error: `MiniMax API error ${resp.status}: ${errText}` };
    return;
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.usage) {
          inputTokens = event.usage.prompt_tokens || 0;
          outputTokens = event.usage.completion_tokens || 0;
        }
        const delta = event.choices?.[0]?.delta;
        if (delta?.content) yield { type: 'text', content: delta.content };
      } catch {}
    }
  }

  yield { type: 'usage', inputTokens, outputTokens };
  yield { type: 'done' };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ProviderCredentials {
  claude?: { apiKey: string };
  openai?: { apiKey: string };
  ollama?: { baseUrl: string };
  google?: { apiKey: string };
  minimax?: { apiKey: string };
}

export async function* sendMessage(
  opts: SendMessageOptions,
  creds: ProviderCredentials,
): AsyncGenerator<StreamChunk> {
  const { provider } = opts;

  // attach credentials via hidden fields
  const enriched = { ...opts } as Record<string, unknown>;
  if (provider === 'claude' && creds.claude) {
    enriched._apiKey = creds.claude.apiKey;
    yield* streamClaude(enriched as unknown as SendMessageOptions);
  } else if (provider === 'openai' && creds.openai) {
    enriched._apiKey = creds.openai.apiKey;
    yield* streamOpenAI(enriched as unknown as SendMessageOptions);
  } else if (provider === 'ollama') {
    enriched._baseUrl = creds.ollama?.baseUrl || 'http://localhost:11434';
    yield* streamOllama(enriched as unknown as SendMessageOptions);
  } else if (provider === 'google' && creds.google) {
    enriched._apiKey = creds.google.apiKey;
    yield* streamGoogle(enriched as unknown as SendMessageOptions);
  } else if (provider === 'minimax' && creds.minimax) {
    enriched._apiKey = creds.minimax.apiKey;
    yield* streamMiniMax(enriched as unknown as SendMessageOptions);
  } else {
    yield {
      type: 'error',
      error: `Provider "${provider}" not configured or API key missing. Go to Settings to add your API key.`,
    };
  }
}

// ─── Smart Router ────────────────────────────────────────────────────────────
// Selects cheapest capable provider for a given task complexity

export interface RouteDecision {
  provider: Provider;
  model: string;
  reason: string;
}

export function routeMessage(
  message: string,
  preferredProvider: Provider,
  preferredModel: string,
  creds: ProviderCredentials,
): RouteDecision {
  const len = message.length;
  const isComplex = len > 500 || /code|debug|analyze|explain in detail/i.test(message);
  const isCoding = /```|function|class |const |def |import |export /i.test(message);

  // if preferred provider has credentials, use it
  const hasCreds = (p: Provider) =>
    p === 'ollama' ||
    (p === 'claude' && !!creds.claude?.apiKey) ||
    (p === 'openai' && !!creds.openai?.apiKey) ||
    (p === 'google' && !!creds.google?.apiKey) ||
    (p === 'minimax' && !!creds.minimax?.apiKey);

  if (hasCreds(preferredProvider)) {
    return { provider: preferredProvider, model: preferredModel, reason: 'User preference' };
  }

  // fallback to any available provider
  if (hasCreds('claude')) {
    const model = isComplex ? 'claude-sonnet-4-5' : 'claude-haiku-4-5';
    return { provider: 'claude', model, reason: 'Auto-routed to Claude' };
  }
  if (hasCreds('openai')) {
    const model = isComplex ? 'gpt-4o' : 'gpt-4o-mini';
    return { provider: 'openai', model, reason: 'Auto-routed to OpenAI' };
  }
  if (hasCreds('google')) {
    return { provider: 'google', model: 'gemini-2.5-flash', reason: 'Auto-routed to Google' };
  }
  if (hasCreds('minimax')) {
    return { provider: 'minimax', model: 'MiniMax-M2.7', reason: 'Auto-routed to MiniMax' };
  }
  if (hasCreds('ollama')) {
    return { provider: 'ollama', model: isCoding ? 'qwen2.5-coder' : 'llama3.2', reason: 'Auto-routed to local Ollama' };
  }

  // no providers — return preference and let the stream emit an error
  return { provider: preferredProvider, model: preferredModel, reason: 'No provider available' };
}
