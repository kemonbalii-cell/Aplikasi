import { Router } from 'express';
import { loadConfig } from '../index.js';

export const modelsRouter = Router();

const ALL_MODELS = [
  { id: 'claude-opus-4-5',     provider: 'claude',  context: 200000, input: 15,   output: 75  },
  { id: 'claude-sonnet-4-5',   provider: 'claude',  context: 200000, input: 3,    output: 15  },
  { id: 'claude-haiku-4-5',    provider: 'claude',  context: 200000, input: 0.8,  output: 4   },
  { id: 'gpt-4o',              provider: 'openai',  context: 128000, input: 5,    output: 15  },
  { id: 'gpt-4o-mini',         provider: 'openai',  context: 128000, input: 0.15, output: 0.6 },
  { id: 'o1',                  provider: 'openai',  context: 200000, input: 15,   output: 60  },
  { id: 'gemini-2.5-flash',    provider: 'google',  context: 1000000,input: 0.3,  output: 2.5 },
  { id: 'gemini-2.5-pro',      provider: 'google',  context: 2000000,input: 3.5,  output: 10.5},
  { id: 'llama3.2',            provider: 'ollama',  context: 128000, input: 0,    output: 0   },
  { id: 'mistral',             provider: 'ollama',  context: 32000,  input: 0,    output: 0   },
  { id: 'qwen2.5-coder',       provider: 'ollama',  context: 128000, input: 0,    output: 0   },
  { id: 'deepseek-r1',         provider: 'ollama',  context: 128000, input: 0,    output: 0   },
];

// GET /v1/models  (OpenAI-compatible)
modelsRouter.get('/', (_req, res) => {
  const config = loadConfig();
  const available = ALL_MODELS.filter((m) => {
    if (m.provider === 'claude') return !!config.providers.claude?.apiKey;
    if (m.provider === 'openai') return !!config.providers.openai?.apiKey;
    if (m.provider === 'google') return !!config.providers.google?.apiKey;
    return true; // ollama always listed
  });

  res.json({
    object: 'list',
    data: available.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1_700_000_000,
      owned_by: m.provider,
      context_window: m.context,
      pricing: { input: m.input, output: m.output },
    })),
  });
});
