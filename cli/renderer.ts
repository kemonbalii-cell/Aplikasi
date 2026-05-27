// Terminal markdown renderer with colors
import chalk from 'chalk';
import { marked, Tokens } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked with terminal renderer
marked.use({ renderer: new TerminalRenderer({
  code: (code: string, lang: string) => {
    const header = chalk.bgGray.white(` ${lang || 'code'} `);
    const lines = code.split('\n').map((l) => '  ' + chalk.cyan(l));
    return `\n${header}\n${lines.join('\n')}\n`;
  },
  heading: (text: string, level: number) => {
    const sizes = [chalk.bold.white, chalk.bold.white, chalk.bold.gray, chalk.gray];
    const prefix = '#'.repeat(level) + ' ';
    return '\n' + (sizes[level - 1] || chalk.white)(prefix + text) + '\n';
  },
  strong: (text: string) => chalk.bold.white(text),
  em: (text: string) => chalk.italic.gray(text),
  codespan: (text: string) => chalk.bgBlack.cyan(` ${text} `),
  link: (href: string, _title: string, text: string) => chalk.blue.underline(`${text} (${href})`),
  list: (body: string) => body,
  listitem: (text: string) => `  ${chalk.cyan('•')} ${text}\n`,
  paragraph: (text: string) => text + '\n',
  hr: () => chalk.gray('─'.repeat(60)) + '\n',
  blockquote: (text: string) => text.split('\n').map((l) => chalk.gray('│ ') + chalk.italic(l)).join('\n') + '\n',
  table: (header: string, body: string) => header + body,
  tablerow: (content: string) => content + '\n',
  tablecell: (content: string) => chalk.gray('| ') + content + ' ',
}) as object });

export function renderMarkdown(text: string): string {
  try {
    return marked(text) as string;
  } catch {
    return text;
  }
}

export function renderChunk(chunk: string): void {
  process.stdout.write(chunk);
}

export function renderDone(): void {
  process.stdout.write('\n');
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export const ui = {
  logo() {
    console.log(chalk.magenta(`
  ╔══════════════════════════════════════════╗
  ║   ASTRA HERMES ULTRA  ·  CLI v1.0.0     ║
  ╚══════════════════════════════════════════╝`));
  },

  prompt: chalk.cyan.bold('you ❯ '),
  assistantLabel: chalk.magenta.bold('astra ❯ '),
  agentLabel: (role: string) => chalk.yellow(`[${role}] `),
  toolLabel: (name: string) => chalk.green(`⚙ ${name}`),
  errorLabel: chalk.red.bold('✗ '),
  successLabel: chalk.green.bold('✓ '),
  dimText: chalk.gray,
  boldText: chalk.bold.white,

  separator() {
    console.log(chalk.gray('─'.repeat(60)));
  },

  cost(tokens: number, cost: number) {
    if (cost > 0) {
      process.stdout.write(chalk.gray(`  [${tokens.toLocaleString()} tokens · $${cost.toFixed(5)}]\n`));
    } else if (tokens > 0) {
      process.stdout.write(chalk.gray(`  [${tokens.toLocaleString()} tokens]\n`));
    }
  },

  help() {
    console.log(`
${chalk.bold.white('Commands')}
  ${chalk.cyan('/help')}        Show this help
  ${chalk.cyan('/memory')}      Show memory entries
  ${chalk.cyan('/clear')}       Clear conversation history
  ${chalk.cyan('/model')}       Change model interactively
  ${chalk.cyan('/tools')}       List available tools
  ${chalk.cyan('/agents')}      Toggle agent pipeline
  ${chalk.cyan('/save')}        Save conversation to file
  ${chalk.cyan('/copy')}        Copy last response to clipboard
  ${chalk.cyan('/exit')}        Exit

${chalk.bold.white('Keyboard')}
  ${chalk.cyan('Ctrl+C')}       Cancel current response
  ${chalk.cyan('Ctrl+D')}       Exit

${chalk.bold.white('Tips')}
  • Prefix with ${chalk.cyan('@filename')} to include file content
  • Prefix with ${chalk.cyan('!')}  to run shell command directly
  • Use ${chalk.cyan('--no-agents')} flag to skip multi-agent pipeline
`);
  },
};
