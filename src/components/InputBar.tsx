import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, Wrench, Brain, ChevronDown, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { MODELS, getModelsForProvider } from '../providers';

export function InputBar() {
  const [value, setValue] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const settings = useStore((s) => s.settings);
  const streamingMessageId = useStore((s) => s.streamingMessageId);
  const { sendUserMessage, updateSettings } = useStore();
  const isStreaming = !!streamingMessageId;

  const selectedModel = MODELS.find((m) => m.id === settings.defaultModel);
  const allModels = MODELS;

  const handleSend = useCallback(async () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendUserMessage(text);
  }, [value, isStreaming, sendUserMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (v: string) => {
    setValue(v);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  const estimateTokens = Math.round(value.length / 4);

  const providersByKey: Record<string, string[]> = {};
  allModels.forEach((m) => {
    if (!providersByKey[m.provider]) providersByKey[m.provider] = [];
    providersByKey[m.provider].push(m.id);
  });

  return (
    <div className="border-t border-white/5 bg-[#0a0a14] p-4">
      {/* Model selector dropdown */}
      <AnimatePresence>
        {modelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-3 bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto"
          >
            {(['claude', 'openai', 'google', 'ollama'] as const).map((provider) => {
              const providerModels = getModelsForProvider(provider);
              if (!providerModels.length) return null;
              return (
                <div key={provider}>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/3">
                    {provider}
                  </div>
                  {providerModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        updateSettings({ defaultModel: m.id, defaultProvider: m.provider });
                        setModelOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                        settings.defaultModel === m.id ? 'text-indigo-400' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-[10px] text-slate-500">{m.description}</span>
                      </div>
                      <div className="text-right text-[10px] text-slate-500 shrink-0 ml-4">
                        <div>${m.inputCostPer1m.toFixed(2)}/M in</div>
                        <div>${m.outputCostPer1m.toFixed(2)}/M out</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-3 bg-[#1a1a2e] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-colors shadow-lg">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleTextareaChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message ASTRA HERMES… (Shift+Enter for newline)"
          rows={1}
          className="flex-1 bg-transparent text-slate-100 text-sm placeholder-slate-500 resize-none outline-none leading-relaxed max-h-48 py-0.5"
          style={{ minHeight: '24px' }}
          disabled={isStreaming}
        />

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0 pb-0.5">
          {/* Token estimate */}
          {value.length > 0 && (
            <span className="text-[10px] text-slate-500 font-mono">
              ~{estimateTokens} tok
            </span>
          )}

          {/* Attach (placeholder) */}
          <button
            title="Attach file (coming soon)"
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
          >
            <Paperclip size={16} />
          </button>

          {/* Tools toggle */}
          <button
            onClick={() => useStore.getState().updateSettings({ enableTools: !settings.enableTools })}
            title={settings.enableTools ? 'Tools enabled' : 'Tools disabled'}
            className={`p-1.5 transition-colors rounded-lg hover:bg-white/5 ${
              settings.enableTools ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            <Wrench size={16} />
          </button>

          {/* Agents toggle */}
          <button
            onClick={() => useStore.getState().updateSettings({ enableAgents: !settings.enableAgents })}
            title={settings.enableAgents ? 'Agents enabled' : 'Agents disabled'}
            className={`p-1.5 transition-colors rounded-lg hover:bg-white/5 ${
              settings.enableAgents ? 'text-violet-400' : 'text-slate-500'
            }`}
          >
            <Brain size={16} />
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || isStreaming}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all active:scale-95"
          >
            {isStreaming ? (
              <Loader2 size={16} className="text-white animate-spin" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between mt-2 px-1">
        <button
          onClick={() => setModelOpen(!modelOpen)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="font-mono">{selectedModel?.name || settings.defaultModel}</span>
          <ChevronDown size={12} className={`transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          {settings.enableTools && <span className="text-amber-600">Tools on</span>}
          {settings.enableAgents && <span className="text-violet-600">Agents on</span>}
          <span>↵ Send · ⇧↵ Newline</span>
        </div>
      </div>
    </div>
  );
}
