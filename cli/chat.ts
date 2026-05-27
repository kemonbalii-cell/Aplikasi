import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { ui, renderMarkdown } from './renderer.js';
import { getConfig } from './config.js';

const GATEWAY = process.env.HERMES_GATEWAY || 'http://localhost:4000';

interface ChatOptions {
  model?: string;
  provider?: string;
  system?: string;
  agents?: boolean;
  tools?: boolean;
  gateway?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Single-shot ask ─────────────────────────────────────────────────────────

export async function ask(question: string, opts: Record<string, string> = {}): Promise<void> {
  const config = getConfig();
  const model = opts.model || config.defaultModel;
  const gw = opts.gateway || GATEWAY;

  process.stdout.write(ui.assistantLabel);

  let totalTokens = 0;
  let cost = 0;

  try {
    const resp = await fetch(`${gw}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: question },
        ],
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!resp.ok) throw new Error(`Gateway error: ${resp.status}`);

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
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          const content = ev.choices?.[0]?.delta?.content;
          if (content) process.stdout.write(content);
          if (ev.usage) {
            totalTokens = ev.usage.total_tokens;
          }
        } catch {}
      }
    }
  } catch {
    // fallback: direct call without gateway
    await directStream(question, model, config, totalTokens);
    return;
  }

  process.stdout.write('\n');
  ui.cost(totalTokens, cost);
}

// ─── Direct stream (no gateway) ──────────────────────────────────────────────

async function directStream(
  message: string,
  model: string,
  config: ReturnType<typeof getConfig>,
  _tokensRef: number,
): Promise<void> {
  const provider = detectProvider(model);
  const creds = config.providers;

  if (provider === 'claude' && creds.claude?.apiKey) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': creds.claude.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
        system: config.systemPrompt,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });
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
          if (ev.delta?.text) process.stdout.write(ev.delta.text);
        } catch {}
      }
    }
  } else if (provider === 'minimax' && creds.minimax?.apiKey) {
    const resp = await fetch('https://api.minimaxi.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.minimax.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(chalk.red(`MiniMax API error ${resp.status}: ${errBody}`));
    } else {
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
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data);
            // MiniMax may return error in stream
            if (ev.error) { console.error(chalk.red(`MiniMax: ${ev.error.message || JSON.stringify(ev.error)}`)); break; }
            const text = ev.choices?.[0]?.delta?.content;
            if (text) process.stdout.write(text);
          } catch {}
        }
      }
    }
  } else {
    console.error(chalk.red('No provider configured. Run: astra config --minimax-key <key>'));
  }
  process.stdout.write('\n');
}

function detectProvider(model: string): string {
  if (model.startsWith('claude')) return 'claude';
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  if (/^(MiniMax|minimax|abab)/i.test(model)) return 'minimax';
  return 'ollama';
}

// ─── Interactive Chat Session ─────────────────────────────────────────────────

export async function chat(opts: ChatOptions): Promise<void> {
  const config = getConfig();
  const model = opts.model || config.defaultModel;
  const gw = opts.gateway || GATEWAY;
  const useAgents = opts.agents !== false && config.enableAgents;

  ui.logo();
  console.log(chalk.gray(`  Model: ${chalk.white(model)}  ·  Gateway: ${gw}`));
  console.log(chalk.gray(`  Agents: ${useAgents ? chalk.green('on') : chalk.red('off')}  ·  Type ${chalk.cyan('/help')} for commands\n`));

  const history: Message[] = [];

  if (opts.system || config.systemPrompt) {
    history.push({ role: 'system', content: opts.system || config.systemPrompt });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: ui.prompt,
  });

  rl.prompt();

  let currentController: AbortController | null = null;

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      switch (cmd) {
        case 'help':
          ui.help();
          break;

        case 'exit':
        case 'quit':
          console.log(chalk.gray('\n  Goodbye.\n'));
          rl.close();
          process.exit(0);
          break;

        case 'clear':
          history.splice(1); // keep system prompt
          console.clear();
          ui.logo();
          console.log(chalk.green('  ✓ Conversation cleared\n'));
          break;

        case 'memory': {
          try {
            const resp = await fetch(`${gw}/v1/memory?limit=10`);
            const data = await resp.json() as { entries: Array<{ key: string; layer: string; content: string; importance: number }> };
            if (!data.entries?.length) { console.log(chalk.gray('  No memories stored\n')); break; }
            console.log(chalk.bold.white('\n  Memory Entries:'));
            data.entries.forEach((e) => {
              console.log(`  ${chalk.cyan(e.key)} ${chalk.gray(`[${e.layer}]`)} ${chalk.gray(`importance: ${e.importance}`)}`);
              console.log(`  ${chalk.gray(e.content.slice(0, 100))}${e.content.length > 100 ? '…' : ''}\n`);
            });
          } catch {
            console.log(chalk.yellow('  Gateway not running. Start with: npx tsx server/index.ts\n'));
          }
          break;
        }

        case 'tools': {
          try {
            const resp = await fetch(`${gw}/v1/tools`);
            const data = await resp.json() as { tools: Array<{ name: string; description: string; category: string }> };
            console.log(chalk.bold.white('\n  Available Tools:'));
            data.tools.forEach((t) => {
              console.log(`  ${chalk.cyan(t.name.padEnd(16))} ${chalk.gray(t.description)}`);
            });
            console.log('');
          } catch {
            console.log(chalk.yellow('  Gateway not running.\n'));
          }
          break;
        }

        case 'model': {
          const newModel = args[0];
          if (newModel) {
            console.log(chalk.green(`  ✓ Switched to model: ${newModel}\n`));
            (opts as Record<string, string>).model = newModel;
          } else {
            console.log(chalk.gray('  Usage: /model <model-name>\n'));
          }
          break;
        }

        case 'save': {
          const fname = args[0] || `astra-chat-${Date.now()}.md`;
          const content = history
            .filter((m) => m.role !== 'system')
            .map((m) => `## ${m.role === 'user' ? 'You' : 'ASTRA'}\n\n${m.content}`)
            .join('\n\n---\n\n');
          fs.writeFileSync(fname, content);
          console.log(chalk.green(`  ✓ Saved to ${fname}\n`));
          break;
        }

        case 'agents': {
          const state = (opts.agents === false) ? 'off' : 'on';
          opts.agents = state === 'on' ? false : true;
          console.log(chalk.green(`  ✓ Agents: ${opts.agents ? 'on' : 'off'}\n`));
          break;
        }

        default:
          console.log(chalk.gray(`  Unknown command: /${cmd}. Type /help for help.\n`));
      }
      rl.prompt();
      return;
    }

    // ── Shell passthrough: !command ────────────────────────────────────────
    if (input.startsWith('!')) {
      const cmd = input.slice(1).trim();
      try {
        const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(chalk.gray(result));
      } catch (e: unknown) {
        const err = e as { stderr?: string; message: string };
        console.error(chalk.red((err.stderr || err.message)));
      }
      rl.prompt();
      return;
    }

    // ── @file include ──────────────────────────────────────────────────────
    let userMessage = input;
    const fileRefs = input.match(/@[\w./\-]+/g) || [];
    for (const ref of fileRefs) {
      const fp = path.resolve(ref.slice(1));
      if (fs.existsSync(fp)) {
        const content = fs.readFileSync(fp, 'utf-8');
        userMessage = userMessage.replace(ref, `\n\n**File: ${fp}**\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\`\n`);
      }
    }

    history.push({ role: 'user', content: userMessage });

    // ── Send to gateway ────────────────────────────────────────────────────
    process.stdout.write('\n' + ui.assistantLabel);
    rl.pause();

    currentController = new AbortController();
    let totalTokens = 0;
    let fullResponse = '';

    try {
      const resp = await fetch(`${gw}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: currentController.signal,
        body: JSON.stringify({
          model: opts.model || model,
          messages: history,
          stream: true,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!resp.ok) throw new Error(`Gateway ${resp.status}`);

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
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const ev = JSON.parse(data);
            const content = ev.choices?.[0]?.delta?.content;
            if (content) { process.stdout.write(content); fullResponse += content; }
            if (ev.usage) totalTokens = ev.usage.total_tokens;
            if (ev.error) throw new Error(ev.error.message);
          } catch (parseErr) {
            if ((parseErr as Error).message !== 'Unexpected end of JSON input') throw parseErr;
          }
        }
      }
    } catch (e: unknown) {
      const err = e as { name: string; message: string };
      if (err.name === 'AbortError') {
        process.stdout.write(chalk.yellow('\n  [cancelled]'));
      } else {
        // Fallback: direct API call
        process.stdout.write(chalk.yellow('\n  [Gateway unreachable, using direct API]\n') + ui.assistantLabel);
        await directStream(userMessage, opts.model || model, config, totalTokens);
        rl.resume();
        rl.prompt();
        return;
      }
    }

    process.stdout.write('\n');
    ui.cost(totalTokens, 0);
    console.log('');

    if (fullResponse) history.push({ role: 'assistant', content: fullResponse });

    currentController = null;
    rl.resume();
    rl.prompt();
  });

  // Ctrl+C: cancel current response, not exit
  rl.on('SIGINT', () => {
    if (currentController) {
      currentController.abort();
      currentController = null;
      process.stdout.write(chalk.yellow(' [cancelled]\n'));
      rl.resume();
      rl.prompt();
    } else {
      console.log(chalk.gray('\n  Type /exit or press Ctrl+D to quit\n'));
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log(chalk.gray('\n  Session ended.\n'));
    process.exit(0);
  });
}
