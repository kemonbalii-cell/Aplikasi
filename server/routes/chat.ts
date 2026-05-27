// /v1/chat — OpenAI-compatible chat completions endpoint
import { Router } from 'express';
import { loadConfig } from '../index.js';
import { streamGateway, startSSE, sendSSE, endSSE } from '../gateway.js';

export const chatRouter = Router();

// POST /v1/chat/completions  (OpenAI-compatible)
chatRouter.post('/completions', async (req, res) => {
  const config = loadConfig();
  const { model, messages, stream, temperature, max_tokens, tools } = req.body;

  const gReq = {
    model: model || config.defaultModel,
    messages,
    temperature: temperature ?? config.temperature,
    max_tokens: max_tokens ?? config.maxTokens,
    stream: !!stream,
    tools,
  };

  if (!stream) {
    // Non-streaming — collect full response
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      for await (const chunk of streamGateway(gReq, config)) {
        if (chunk.type === 'text' && chunk.content) fullText += chunk.content;
        if (chunk.type === 'usage') {
          inputTokens += chunk.inputTokens || 0;
          outputTokens += chunk.outputTokens || 0;
        }
        if (chunk.type === 'error') throw new Error(chunk.error);
      }
    } catch (e) {
      res.status(500).json({ error: { message: (e as Error).message } });
      return;
    }
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: gReq.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: fullText },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    });
    return;
  }

  // Streaming SSE — OpenAI-compatible format
  startSSE(res);
  const id = `chatcmpl-${Date.now()}`;

  try {
    for await (const chunk of streamGateway(gReq, config)) {
      if (chunk.type === 'text' && chunk.content) {
        sendSSE(res, {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: gReq.model,
          choices: [{ index: 0, delta: { content: chunk.content }, finish_reason: null }],
        });
      } else if (chunk.type === 'usage') {
        sendSSE(res, {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: gReq.model,
          choices: [],
          usage: {
            prompt_tokens: chunk.inputTokens || 0,
            completion_tokens: chunk.outputTokens || 0,
            total_tokens: (chunk.inputTokens || 0) + (chunk.outputTokens || 0),
          },
        });
      } else if (chunk.type === 'tool_use') {
        sendSSE(res, {
          id,
          object: 'chat.completion.chunk',
          model: gReq.model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: 0,
                id: chunk.toolId,
                type: 'function',
                function: { name: chunk.toolName, arguments: JSON.stringify(chunk.toolInput) },
              }],
            },
            finish_reason: null,
          }],
        });
      } else if (chunk.type === 'error') {
        sendSSE(res, { error: { message: chunk.error } });
        break;
      } else if (chunk.type === 'done') {
        sendSSE(res, {
          id,
          object: 'chat.completion.chunk',
          model: gReq.model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        });
        break;
      }
    }
  } catch (e) {
    sendSSE(res, { error: { message: (e as Error).message } });
  }

  endSSE(res);
});
