// ─── Core Enums & Scalars ───────────────────────────────────────────────────

export type Provider = 'claude' | 'openai' | 'ollama' | 'google' | 'minimax';
export type AgentRole =
  | 'planner'
  | 'executor'
  | 'reviewer'
  | 'debugger'
  | 'memory'
  | 'router'
  | 'researcher'
  | 'optimizer';
export type MemoryLayer = 'session' | 'project' | 'global' | 'strategy' | 'tool' | 'knowledge';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type ToolStatus = 'idle' | 'running' | 'done' | 'error';
export type View = 'chat' | 'memory' | 'agents' | 'tools' | 'settings' | 'cost';
export type Theme = 'dark' | 'light';

// ─── Models & Providers ─────────────────────────────────────────────────────

export interface ModelDef {
  id: string;
  name: string;
  provider: Provider;
  contextWindow: number;
  inputCostPer1m: number;   // USD
  outputCostPer1m: number;  // USD
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  description: string;
}

export interface ProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

// ─── Messages ───────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  provider?: Provider;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  agentRole?: AgentRole;
  toolCalls?: ToolCall[];
  thinking?: string;
  isStreaming?: boolean;
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  provider: Provider;
  model: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  tags: string[];
  isPinned: boolean;
  systemPrompt?: string;
}

// ─── Memory ─────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  layer: MemoryLayer;
  key: string;
  content: string;
  importance: number;  // 0–10
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  tags: string[];
  sessionId?: string;
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required: string[];
}

export interface ToolContext {
  sessionId: string;
  memories: MemoryEntry[];
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  executionTime: number;
}

export interface Tool {
  name: string;
  displayName: string;
  description: string;
  category: 'search' | 'code' | 'memory' | 'data' | 'system' | 'file';
  inputSchema: ToolInputSchema;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolExecutionResult>;
  requiresConfirmation?: boolean;
  isBuiltin: boolean;
}

// ─── Agents ─────────────────────────────────────────────────────────────────

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
  temperature: number;
}

export interface AgentStep {
  agentRole: AgentRole;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  input?: string;
  output?: string;
  startTime?: number;
  endTime?: number;
  tokens?: number;
  cost?: number;
}

export interface AgentPipeline {
  id: string;
  sessionId: string;
  userMessage: string;
  steps: AgentStep[];
  status: 'pending' | 'running' | 'done' | 'error';
  finalResponse?: string;
  totalTokens: number;
  totalCost: number;
  startTime: number;
  endTime?: number;
}

// ─── Cost Tracking ──────────────────────────────────────────────────────────

export interface CostRecord {
  id: string;
  sessionId: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
  agentRole?: AgentRole;
}

// ─── App Settings ───────────────────────────────────────────────────────────

export interface AppSettings {
  theme: Theme;
  providers: Record<Provider, ProviderSettings>;
  defaultProvider: Provider;
  defaultModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
  enableMemory: boolean;
  enableTools: boolean;
  enableAgents: boolean;
  enableCostTracking: boolean;
  enabledAgents: AgentRole[];
  compressContextAt: number;
  autoTitle: boolean;
}

// ─── Streaming ──────────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'usage';
  content?: string;
  toolCall?: Partial<ToolCall>;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export interface SendMessageOptions {
  sessionId: string;
  content: string;
  provider: Provider;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  onChunk?: (chunk: StreamChunk) => void;
}
