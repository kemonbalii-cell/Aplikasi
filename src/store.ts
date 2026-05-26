import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Session, Message, AgentPipeline, CostRecord,
  AppSettings, View, Provider, ToolCall,
} from './types';
import { sendMessage, routeMessage, getModel, calcCost } from './providers';
import { getTools, executeTool } from './tools';
import { orchestrate } from './agents';
import { getMemories } from './memory';

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  providers: {
    claude:  { apiKey: '', enabled: true },
    openai:  { apiKey: '', enabled: true },
    ollama:  { baseUrl: 'http://localhost:11434', enabled: true },
    google:  { apiKey: '', enabled: true },
  },
  defaultProvider: 'claude',
  defaultModel: 'claude-sonnet-4-5',
  systemPrompt: `You are ASTRA HERMES ULTRA — an advanced autonomous AI engineering assistant.
You are highly capable, proactive, goal-driven, transparent, tool-oriented, and safe by default.
Use tools when appropriate. Write clean, well-explained code. Be thorough but concise.
Always use markdown with syntax-highlighted code blocks.`,
  temperature: 0.7,
  maxTokens: 4096,
  enableStreaming: true,
  enableMemory: true,
  enableTools: true,
  enableAgents: true,
  enableCostTracking: true,
  enabledAgents: ['planner', 'executor', 'memory', 'researcher'],
  compressContextAt: 50,
  autoTitle: true,
};

// ─── Store Shape ─────────────────────────────────────────────────────────────

interface State {
  // Data
  sessions: Session[];
  currentSessionId: string | null;
  pipelines: AgentPipeline[];
  costRecords: CostRecord[];
  settings: AppSettings;

  // UI state (not persisted)
  activeView: View;
  rightPanelOpen: boolean;
  rightPanelTab: 'memory' | 'agents' | 'tools' | 'cost';
  sidebarOpen: boolean;
  streamingMessageId: string | null;

  // ─── Actions ─────────────────────────────────────────────────────────────
  // Sessions
  createSession: (opts?: Partial<Pick<Session, 'title' | 'provider' | 'model'>>) => Session;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  pinSession: (id: string, pinned: boolean) => void;
  clearSession: (id: string) => void;

  // Messages
  sendUserMessage: (content: string) => Promise<void>;
  appendStreamChunk: (sessionId: string, messageId: string, chunk: string) => void;
  finalizeMessage: (sessionId: string, messageId: string, patch: Partial<Message>) => void;
  addMessage: (sessionId: string, msg: Message) => void;

  // Costs
  addCostRecord: (record: Omit<CostRecord, 'id'>) => void;
  clearCosts: () => void;

  // Pipelines
  upsertPipeline: (pipeline: AgentPipeline) => void;

  // UI
  setActiveView: (view: View) => void;
  setRightPanel: (open: boolean, tab?: State['rightPanelTab']) => void;
  setSidebarOpen: (open: boolean) => void;

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void;
  setProviderKey: (provider: Provider, key: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provider: DEFAULT_SETTINGS.defaultProvider,
    model: DEFAULT_SETTINGS.defaultModel,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    tags: [],
    isPinned: false,
    ...overrides,
  };
}

function makeMessage(role: Message['role'], content: string, extras?: Partial<Message>): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...extras,
  };
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export function selectCurrentSession(state: State): Session | null {
  return state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
}

export function selectCurrentMessages(state: State): Message[] {
  return selectCurrentSession(state)?.messages ?? [];
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      pipelines: [],
      costRecords: [],
      settings: DEFAULT_SETTINGS,

      activeView: 'chat',
      rightPanelOpen: false,
      rightPanelTab: 'agents',
      sidebarOpen: true,
      streamingMessageId: null,

      // ─── Sessions ─────────────────────────────────────────────────────────
      createSession(opts) {
        const { settings } = get();
        const s = makeSession({
          provider: settings.defaultProvider,
          model: settings.defaultModel,
          ...opts,
        });
        set((st) => ({ sessions: [s, ...st.sessions], currentSessionId: s.id }));
        return s;
      },

      selectSession(id) {
        set({ currentSessionId: id, activeView: 'chat' });
      },

      deleteSession(id) {
        set((st) => {
          const remaining = st.sessions.filter((s) => s.id !== id);
          const newCurrent = st.currentSessionId === id
            ? (remaining[0]?.id ?? null)
            : st.currentSessionId;
          return { sessions: remaining, currentSessionId: newCurrent };
        });
      },

      updateSessionTitle(id, title) {
        set((st) => ({
          sessions: st.sessions.map((s) => s.id === id ? { ...s, title } : s),
        }));
      },

      pinSession(id, pinned) {
        set((st) => ({
          sessions: st.sessions.map((s) => s.id === id ? { ...s, isPinned: pinned } : s),
        }));
      },

      clearSession(id) {
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === id
              ? { ...s, messages: [], totalCost: 0, inputTokens: 0, outputTokens: 0 }
              : s,
          ),
        }));
      },

      // ─── Messages ─────────────────────────────────────────────────────────
      addMessage(sessionId, msg) {
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, msg], updatedAt: Date.now() }
              : s,
          ),
        }));
      },

      appendStreamChunk(sessionId, messageId, chunk) {
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + chunk } : m,
                  ),
                }
              : s,
          ),
        }));
      },

      finalizeMessage(sessionId, messageId, patch) {
        set((st) => ({
          streamingMessageId: null,
          sessions: st.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, ...patch, isStreaming: false } : m,
                  ),
                  totalCost: s.totalCost + (patch.cost ?? 0),
                  inputTokens: s.inputTokens + (patch.inputTokens ?? 0),
                  outputTokens: s.outputTokens + (patch.outputTokens ?? 0),
                  updatedAt: Date.now(),
                }
              : s,
          ),
        }));
      },

      // ─── Core Send ────────────────────────────────────────────────────────
      async sendUserMessage(content: string) {
        const st = get();
        let session = selectCurrentSession(st);

        if (!session) {
          session = get().createSession();
        }

        const { settings } = st;
        const creds = {
          claude: { apiKey: settings.providers.claude.apiKey },
          openai: { apiKey: settings.providers.openai.apiKey },
          ollama: { baseUrl: settings.providers.ollama.baseUrl ?? 'http://localhost:11434' },
          google: { apiKey: settings.providers.google.apiKey },
        };

        const route = routeMessage(content, session.provider, session.model, creds);

        // Add user message
        const userMsg = makeMessage('user', content);
        get().addMessage(session.id, userMsg);

        // Auto-title on first message
        if (settings.autoTitle && session.messages.length === 0) {
          get().updateSessionTitle(session.id, content.slice(0, 50) + (content.length > 50 ? '…' : ''));
        }

        // ── Multi-agent pipeline ─────────────────────────────────────────
        if (settings.enableAgents && settings.enabledAgents.length > 1) {
          const memories = getMemories();
          const pipeline: AgentPipeline = {
            id: crypto.randomUUID(),
            sessionId: session.id,
            userMessage: content,
            steps: [],
            status: 'pending',
            totalTokens: 0,
            totalCost: 0,
            startTime: Date.now(),
          };
          get().upsertPipeline(pipeline);
          set({ rightPanelOpen: true, rightPanelTab: 'agents' });

          const finalPipeline = await orchestrate({
            pipeline,
            provider: route.provider,
            model: route.model,
            creds,
            enabledAgents: settings.enabledAgents,
            onStepUpdate: (p) => get().upsertPipeline(p),
          });

          const assistantMsg = makeMessage('assistant', finalPipeline.finalResponse ?? '', {
            provider: route.provider,
            model: route.model,
            cost: finalPipeline.totalCost,
          });
          get().addMessage(session.id, assistantMsg);

          if (settings.enableCostTracking && finalPipeline.totalCost > 0) {
            get().addCostRecord({
              sessionId: session.id,
              provider: route.provider,
              model: route.model,
              inputTokens: Math.round(finalPipeline.totalTokens * 0.6),
              outputTokens: Math.round(finalPipeline.totalTokens * 0.4),
              cost: finalPipeline.totalCost,
              timestamp: Date.now(),
            });
          }

          get().finalizeMessage(session.id, assistantMsg.id, {});
          return;
        }

        // ── Direct streaming ─────────────────────────────────────────────
        const assistantMsg = makeMessage('assistant', '', {
          provider: route.provider,
          model: route.model,
          isStreaming: true,
        });
        get().addMessage(session.id, assistantMsg);
        set({ streamingMessageId: assistantMsg.id });

        let inputTokens = 0;
        let outputTokens = 0;
        const pendingToolCalls: ToolCall[] = [];
        const tools = settings.enableTools ? getTools() : [];

        try {
          const gen = sendMessage(
            {
              sessionId: session.id,
              content,
              provider: route.provider,
              model: route.model,
              systemPrompt: settings.systemPrompt,
              temperature: settings.temperature,
              maxTokens: settings.maxTokens,
              tools: tools.length ? tools : undefined,
            },
            creds,
          );

          for await (const chunk of gen) {
            if (chunk.type === 'text' && chunk.content) {
              get().appendStreamChunk(session.id, assistantMsg.id, chunk.content);
            } else if (chunk.type === 'tool_use' && chunk.toolCall) {
              const tc: ToolCall = {
                id: chunk.toolCall.id ?? crypto.randomUUID(),
                toolName: chunk.toolCall.toolName ?? '',
                input: chunk.toolCall.input ?? {},
                status: 'running',
                startTime: Date.now(),
              };
              pendingToolCalls.push(tc);
              get().appendStreamChunk(session.id, assistantMsg.id, `\n\n> **Tool:** \`${tc.toolName}\`\n`);

              const result = await executeTool(tc.toolName, tc.input, {
                sessionId: session.id,
                memories: getMemories(),
              });
              tc.status = result.success ? 'done' : 'error';
              tc.result = result.data;
              tc.error = result.error;
              tc.endTime = Date.now();

              const display = result.success
                ? `\`\`\`\n${result.output}\n\`\`\``
                : `**Error:** ${result.error}`;
              get().appendStreamChunk(session.id, assistantMsg.id, display + '\n\n');
            } else if (chunk.type === 'usage') {
              inputTokens = chunk.inputTokens ?? 0;
              outputTokens = chunk.outputTokens ?? 0;
            } else if (chunk.type === 'error') {
              get().appendStreamChunk(
                session.id,
                assistantMsg.id,
                `\n\n⚠️ **Error:** ${chunk.error}`,
              );
            }
          }
        } catch (e) {
          get().appendStreamChunk(
            session.id,
            assistantMsg.id,
            `\n\n⚠️ **Error:** ${(e as Error).message}`,
          );
        }

        const modelDef = getModel(route.model);
        const cost = modelDef ? calcCost(modelDef, inputTokens, outputTokens) : 0;

        get().finalizeMessage(session.id, assistantMsg.id, {
          inputTokens,
          outputTokens,
          cost,
          toolCalls: pendingToolCalls.length ? pendingToolCalls : undefined,
        });

        if (settings.enableCostTracking && cost > 0) {
          get().addCostRecord({
            sessionId: session.id,
            provider: route.provider,
            model: route.model,
            inputTokens,
            outputTokens,
            cost,
            timestamp: Date.now(),
          });
        }
      },

      // ─── Costs ────────────────────────────────────────────────────────────
      addCostRecord(record) {
        const cr: CostRecord = { ...record, id: crypto.randomUUID() };
        set((st) => ({ costRecords: [...st.costRecords, cr] }));
      },

      clearCosts() {
        set({ costRecords: [] });
      },

      // ─── Pipelines ────────────────────────────────────────────────────────
      upsertPipeline(pipeline) {
        set((st) => {
          const idx = st.pipelines.findIndex((p) => p.id === pipeline.id);
          if (idx >= 0) {
            const copy = [...st.pipelines];
            copy[idx] = pipeline;
            return { pipelines: copy };
          }
          return { pipelines: [...st.pipelines, pipeline] };
        });
      },

      // ─── UI ───────────────────────────────────────────────────────────────
      setActiveView(view) {
        set({ activeView: view });
      },

      setRightPanel(open, tab) {
        set((st) => ({ rightPanelOpen: open, rightPanelTab: tab ?? st.rightPanelTab }));
      },

      setSidebarOpen(open) {
        set({ sidebarOpen: open });
      },

      // ─── Settings ─────────────────────────────────────────────────────────
      updateSettings(patch) {
        set((st) => ({ settings: { ...st.settings, ...patch } }));
      },

      setProviderKey(provider, key) {
        set((st) => ({
          settings: {
            ...st.settings,
            providers: {
              ...st.settings.providers,
              [provider]: { ...st.settings.providers[provider], apiKey: key },
            },
          },
        }));
      },
    }),
    {
      name: 'astra-hermes-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.slice(-100),
        })),
        settings: state.settings,
        costRecords: state.costRecords.slice(-1000),
        pipelines: state.pipelines.slice(-20),
      }),
    },
  ),
);
