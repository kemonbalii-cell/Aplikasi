import chalk from 'chalk';

// Simple terminal markdown renderer — no external marked-terminal dependency needed

export function renderMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      const header = chalk.bgGray.white(` ${lang || 'code'} `);
      const lines = code.trimEnd().split('\n').map((l: string) => '  ' + chalk.cyan(l));
      return `\n${header}\n${lines.join('\n')}\n`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, (_m: string, c: string) => chalk.bgBlack.cyan(` ${c} `))
    // Bold
    .replace(/\*\*(.+?)\*\*/g, (_m: string, t: string) => chalk.bold.white(t))
    // Italic
    .replace(/\*(.+?)\*/g, (_m: string, t: string) => chalk.italic(t))
    // H1
    .replace(/^# (.+)$/gm, (_m: string, t: string) => chalk.bold.white.underline('\n' + t))
    // H2
    .replace(/^## (.+)$/gm, (_m: string, t: string) => chalk.bold.white('\n' + t))
    // H3
    .replace(/^### (.+)$/gm, (_m: string, t: string) => chalk.bold.gray('\n' + t))
    // Bullets
    .replace(/^[\s]*[-*] (.+)$/gm, (_m: string, t: string) => `  ${chalk.cyan('•')} ${t}`)
    // Numbered list
    .replace(/^(\d+)\. (.+)$/gm, (_m: string, n: string, t: string) => `  ${chalk.cyan(n + '.')} ${t}`)
    // Horizontal rule
    .replace(/^---+$/gm, chalk.gray('─'.repeat(60)))
    // Blockquote
    .replace(/^> (.+)$/gm, (_m: string, t: string) => chalk.gray('│ ') + chalk.italic(t));
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
  assistantLabel: chalk.magenta.bold('\nastra ❯ '),
  agentLabel: (role: string) => chalk.yellow(`[${role}] `),
  toolLabel: (name: string) => chalk.green(`⚙ ${name}`),
  dimText: chalk.gray,
  boldText: chalk.bold.white,

  separator() {
    console.log(chalk.gray('─'.repeat(60)));
  },

  cost(tokens: number, cost: number) {
    const parts = [];
    if (tokens > 0) parts.push(`${tokens.toLocaleString()} tokens`);
    if (cost > 0) parts.push(`$${cost.toFixed(5)}`);
    if (parts.length) process.stdout.write(chalk.gray(`  [${parts.join(' · ')}]\n`));
  },

  help() {
    console.log(`
${chalk.bold.white('Commands')}
  ${chalk.cyan('/help')}          Show this help
  ${chalk.cyan('/memory')}        Show stored memories
  ${chalk.cyan('/clear')}         Clear conversation history
  ${chalk.cyan('/model <name>')}  Switch model (e.g. /model gpt-4o)
  ${chalk.cyan('/tools')}         List available tools
  ${chalk.cyan('/agents')}        Toggle agent pipeline on/off
  ${chalk.cyan('/save [file]')}   Save conversation to markdown file
  ${chalk.cyan('/exit')}          Exit

${chalk.bold.white('Shortcuts')}
  ${chalk.cyan('@path/to/file')}  Inject file content into message
  ${chalk.cyan('!command')}       Run shell command (e.g. !git status)
  ${chalk.cyan('Ctrl+C')}         Cancel current response
  ${chalk.cyan('Ctrl+D')}         Exit
`);
  },
};
