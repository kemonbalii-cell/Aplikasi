#!/usr/bin/env node
// ─── ASTRA HERMES ULTRA — CLI ─────────────────────────────────────────────────
// Interactive terminal interface — like Claude Code, but with multi-provider support

import { Command } from 'commander';
import { chat } from './chat.js';
import { configCmd } from './config.js';

const program = new Command();

program
  .name('astra')
  .description('ASTRA HERMES ULTRA — Advanced AI Agent CLI')
  .version('1.0.0');

// Default: interactive chat
program
  .command('chat', { isDefault: true })
  .description('Start interactive AI chat session')
  .option('-m, --model <model>', 'Model to use (overrides config)')
  .option('-p, --provider <provider>', 'Provider: claude|openai|google|ollama')
  .option('-s, --system <prompt>', 'System prompt override')
  .option('--no-agents', 'Disable multi-agent pipeline')
  .option('--no-tools', 'Disable tools')
  .option('-g, --gateway <url>', 'Gateway URL (default: http://localhost:4000)')
  .action(chat);

// Config management
program
  .command('config')
  .description('Configure API keys and settings')
  .option('--claude-key <key>', 'Set Anthropic Claude API key')
  .option('--openai-key <key>', 'Set OpenAI API key')
  .option('--google-key <key>', 'Set Google Gemini API key')
  .option('--ollama-url <url>', 'Set Ollama base URL')
  .option('--model <model>', 'Set default model')
  .option('--show', 'Show current config')
  .action(configCmd);

// Single-shot question
program
  .command('ask <question>')
  .description('Ask a one-shot question (non-interactive)')
  .option('-m, --model <model>', 'Model to use')
  .option('-g, --gateway <url>', 'Gateway URL')
  .action(async (question: string, opts: Record<string, string>) => {
    const { ask } = await import('./chat.js');
    await ask(question, opts);
  });

program.parse();
