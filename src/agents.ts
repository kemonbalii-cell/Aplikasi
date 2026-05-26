import type { AgentConfig, AgentPipeline, AgentRole, AgentStep, Provider } from './types';
import type { ProviderCredentials } from './providers';
import { sendMessage, getModel, calcCost } from './providers';
import { searchMemory, addMemory } from './memory';

// ─── Agent Definitions ───────────────────────────────────────────────────────

export const AGENT_CONFIGS: AgentConfig[] = [
  { role: 'router',     name: 'Router',     description: 'Analyzes message and decides which agents to invoke', color: '#a78bfa', enabled: true,  temperature: 0.1 },
  { role: 'planner',    name: 'Planner',    description: 'Breaks complex tasks into actionable subtasks',        color: '#60a5fa', enabled: true,  temperature: 0.3 },
  { role: 'researcher', name: 'Researcher', description: 'Gathers relevant context and knowledge',               color: '#34d399', enabled: true,  temperature: 0.5 },
  { role: 'executor',   name: 'Executor',   description: 'Performs the primary task with full capabilities',     color: '#f59e0b', enabled: true,  temperature: 0.7 },
  { role: 'reviewer',   name: 'Reviewer',   description: 'Reviews output quality and accuracy',                  color: '#f87171', enabled: false, temperature: 0.2 },
  { role: 'debugger',   name: 'Debugger',   description: 'Identifies and fixes issues in code or logic',         color: '#fb923c', enabled: false, temperature: 0.2 },
  { role: 'optimizer',  name: 'Optimizer',  description: 'Improves response clarity and conciseness',            color: '#38bdf8', enabled: false, temperature: 0.3 },
  { role: 'memory',     name: 'Memory',     description: 'Extracts and stores important facts from conversation', color: '#a3e635', enabled: true,  temperature: 0.1 },
];

// ─── System Prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  router: `You are a routing agent. Analyze the user's message and decide which pipeline to use.
Respond with JSON only: { "pipeline": "simple" | "complex" | "research" | "debug", "reason": "..." }
- simple: basic Q&A, casual chat, simple tasks
- complex: multi-step tasks, planning, architecture, coding projects
- research: needs web data, current events, technical documentation
- debug: debugging code, fixing errors, analyzing stack traces`,

  planner: `You are a planning agent. Break down the user's complex task into numbered subtasks.
Be concise. Output a structured plan with 3-7 clear steps.
Focus on what needs to happen, not how.
Start with "PLAN:" followed by numbered steps.`,

  researcher: `You are a research agent. Your job is to identify what relevant information, context, or knowledge is needed to answer the user's question.
List the key information points needed. If you have relevant memories provided, summarize what's useful.
Output: "RESEARCH NOTES:" followed by bullet points.`,

  executor: `You are ASTRA HERMES ULTRA — an advanced autonomous AI engineering assistant.
You are highly capable, proactive, goal-driven, transparent, and tool-oriented.
You use tools when helpful, think step-by-step for complex problems, write clean and well-explained code, and always aim for the best answer.
Be thorough but concise. Use markdown formatting. Use code blocks with language tags.
Never refuse helpful tasks. Always be constructive.`,

  reviewer: `You are a quality reviewer. Review the previous response for:
1. Accuracy and correctness
2. Completeness (missing important parts?)
3. Clarity (is it easy to understand?)
If the response is good, respond: "REVIEW: APPROVED"
If it needs improvement, respond: "REVIEW: NEEDS IMPROVEMENT\n[specific issues]"`,

  debugger: `You are a debugging specialist. Your focus is on:
1. Identifying root causes of errors/bugs
2. Analyzing stack traces and error messages
3. Suggesting precise fixes
4. Explaining why the bug occurred
Be methodical. Provide working code fixes.`,

  optimizer: `You are a response optimizer. Take the previous response and improve it by:
1. Making it more concise (remove fluff)
2. Improving code quality/clarity
3. Better formatting and structure
4. Clearer explanations
Output the optimized version directly (no meta-commentary).`,

  memory: `You are a memory extraction agent. Read the conversation and extract important facts, preferences, decisions, or knowledge worth remembering.
Output JSON array: [{ "key": "...", "content": "...", "importance": 1-10, "layer": "project|global|knowledge" }]
Only extract genuinely useful long-term information. Skip trivial details.`,
};

// ─── Pipeline Determination ──────────────────────────────────────────────────

function simplePipeline(): AgentRole[] {
  return ['executor'];
}

function complexPipeline(enabledAgents: AgentRole[]): AgentRole[] {
  const base: AgentRole[] = ['planner', 'executor'];
  if (enabledAgents.includes('reviewer')) base.push('reviewer');
  if (enabledAgents.includes('optimizer')) base.push('optimizer');
  return base;
}

function researchPipeline(enabledAgents: AgentRole[]): AgentRole[] {
  const base: AgentRole[] = ['researcher', 'executor'];
  if (enabledAgents.includes('reviewer')) base.push('reviewer');
  return base;
}

function debugPipeline(): AgentRole[] {
  return ['debugger', 'executor'];
}

// ─── Single Agent Call ───────────────────────────────────────────────────────

async function callAgent(
  role: AgentRole,
  content: string,
  provider: Provider,
  model: string,
  creds: ProviderCredentials,
  temperature: number,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const gen = sendMessage(
    {
      sessionId: 'agent',
      content,
      provider,
      model,
      systemPrompt: SYSTEM_PROMPTS[role],
      temperature,
      maxTokens: role === 'memory' ? 512 : 2048,
    },
    creds,
  );

  for await (const chunk of gen) {
    if (chunk.type === 'text' && chunk.content) text += chunk.content;
    if (chunk.type === 'usage') {
      inputTokens = chunk.inputTokens || 0;
      outputTokens = chunk.outputTokens || 0;
    }
    if (chunk.type === 'error') {
      text = `[Agent Error: ${chunk.error}]`;
      break;
    }
  }

  return { text, inputTokens, outputTokens };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export interface OrchestrationOptions {
  pipeline: AgentPipeline;
  provider: Provider;
  model: string;
  creds: ProviderCredentials;
  enabledAgents: AgentRole[];
  onStepUpdate: (pipeline: AgentPipeline) => void;
}

export async function orchestrate(opts: OrchestrationOptions): Promise<AgentPipeline> {
  const { pipeline, provider, model, creds, enabledAgents, onStepUpdate } = opts;
  const userMessage = pipeline.userMessage;

  // Retrieve relevant memories
  const memories = searchMemory(userMessage, 3);
  const memoryContext = memories.length
    ? `\n\nRELEVANT MEMORIES:\n${memories.map((m) => `- [${m.key}]: ${m.content}`).join('\n')}`
    : '';

  // Determine pipeline type via router (lightweight call)
  let pipelineType = 'simple';

  if (enabledAgents.length > 1) {
    try {
      const { text } = await callAgent('router', userMessage, provider, model, creds, 0.1);
      const match = text.match(/"pipeline"\s*:\s*"(\w+)"/);
      pipelineType = (match?.[1] || 'simple') as typeof pipelineType;
    } catch {}
  }

  // Build agent steps
  let agentRoles: AgentRole[];
  if (pipelineType === 'complex') agentRoles = complexPipeline(enabledAgents);
  else if (pipelineType === 'research') agentRoles = researchPipeline(enabledAgents);
  else if (pipelineType === 'debug') agentRoles = debugPipeline();
  else agentRoles = simplePipeline();

  // filter to only enabled agents (executor always runs)
  agentRoles = agentRoles.filter(
    (r) => r === 'executor' || enabledAgents.includes(r),
  );

  // init steps
  pipeline.steps = agentRoles.map((role) => ({
    agentRole: role,
    status: 'pending' as const,
  }));
  pipeline.status = 'running';
  onStepUpdate({ ...pipeline });

  let contextAccumulator = userMessage + memoryContext;
  let finalResponse = '';

  for (let i = 0; i < agentRoles.length; i++) {
    const role = agentRoles[i];
    const cfg = AGENT_CONFIGS.find((a) => a.role === role)!;

    pipeline.steps[i].status = 'running';
    pipeline.steps[i].startTime = Date.now();
    pipeline.steps[i].input = contextAccumulator;
    onStepUpdate({ ...pipeline });

    const { text, inputTokens, outputTokens } = await callAgent(
      role,
      contextAccumulator,
      provider,
      model,
      creds,
      cfg.temperature,
    );

    const modelDef = getModel(model);
    const stepCost = modelDef ? calcCost(modelDef, inputTokens, outputTokens) : 0;

    pipeline.steps[i].status = 'done';
    pipeline.steps[i].endTime = Date.now();
    pipeline.steps[i].output = text;
    pipeline.steps[i].tokens = inputTokens + outputTokens;
    pipeline.steps[i].cost = stepCost;
    pipeline.totalTokens += inputTokens + outputTokens;
    pipeline.totalCost += stepCost;

    // Reviewer can halt pipeline
    if (role === 'reviewer' && text.includes('NEEDS IMPROVEMENT')) {
      // restart executor with feedback
      contextAccumulator = `ORIGINAL TASK: ${userMessage}\n\nPREVIOUS RESPONSE:\n${finalResponse}\n\nREVIEWER FEEDBACK:\n${text}\n\nPlease provide an improved response addressing the feedback.`;
    } else if (role === 'executor') {
      finalResponse = text;
      contextAccumulator = `ORIGINAL TASK: ${userMessage}\n\nEXECUTOR RESPONSE:\n${text}`;
    } else if (role === 'optimizer') {
      finalResponse = text;
    } else if (role === 'planner') {
      contextAccumulator = `ORIGINAL TASK: ${userMessage}\n\nPLAN:\n${text}\n\nNow execute this plan step by step, providing a comprehensive response.`;
    } else if (role === 'researcher') {
      contextAccumulator = `ORIGINAL TASK: ${userMessage}\n\nRESEARCH CONTEXT:\n${text}\n\nUsing this research, provide a thorough response.`;
    } else if (role === 'debugger') {
      contextAccumulator = `ORIGINAL TASK: ${userMessage}\n\nDEBUGGER ANALYSIS:\n${text}\n\nBased on this analysis, provide the solution and explanation.`;
    }

    onStepUpdate({ ...pipeline });
  }

  // Memory agent runs asynchronously (fire and forget)
  if (enabledAgents.includes('memory') && finalResponse.length > 100) {
    callAgent(
      'memory',
      `CONVERSATION:\nUser: ${userMessage}\nAssistant: ${finalResponse}`,
      provider,
      model,
      creds,
      0.1,
    ).then(({ text }) => {
      try {
        const entries = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]');
        if (Array.isArray(entries)) {
          entries.forEach((e: { key?: string; content?: string; importance?: number; layer?: string }) => {
            if (e.key && e.content) {
              addMemory(
                (e.layer || 'project') as import('./types').MemoryLayer,
                e.key!,
                e.content!,
                e.importance || 5,
              );
            }
          });
        }
      } catch {}
    }).catch(() => {});
  }

  pipeline.status = 'done';
  pipeline.finalResponse = finalResponse;
  pipeline.endTime = Date.now();
  onStepUpdate({ ...pipeline });

  return pipeline;
}
