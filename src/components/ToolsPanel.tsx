import { useState } from 'react';
import { motion } from 'motion/react';
import { Wrench, Play, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getTools, executeTool } from '../tools';
import type { Tool } from '../types';
import { useStore } from '../store';

const CATEGORY_COLORS: Record<string, string> = {
  search: 'text-blue-400 bg-blue-900/20',
  code:   'text-amber-400 bg-amber-900/20',
  memory: 'text-emerald-400 bg-emerald-900/20',
  data:   'text-violet-400 bg-violet-900/20',
  system: 'text-slate-400 bg-slate-900/20',
  file:   'text-orange-400 bg-orange-900/20',
};

export function ToolsPanel() {
  const tools = getTools();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const categories = [...new Set(tools.map((t) => t.category))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Wrench size={16} className="text-amber-400" />
        <span className="text-sm font-semibold text-slate-200">Tools</span>
        <span className="text-xs text-slate-500">{tools.length} available</span>
      </div>

      {/* Tools list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
        {categories.map((category) => (
          <div key={category}>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 px-1">{category}</p>
            <div className="space-y-1.5">
              {tools.filter((t) => t.category === category).map((tool) => (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  expanded={expandedTool === tool.name}
                  onToggle={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCard({ tool, expanded, onToggle }: {
  tool: Tool;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ success: boolean; output: string; time: number } | null>(null);
  const [running, setRunning] = useState(false);
  const { currentSessionId } = useStore();

  const catStyle = CATEGORY_COLORS[tool.category] || 'text-slate-400 bg-slate-900/20';

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    const t0 = Date.now();
    const res = await executeTool(tool.name, inputs, {
      sessionId: currentSessionId || '',
      memories: [],
    });
    setResult({ success: res.success, output: res.output, time: Date.now() - t0 });
    setRunning(false);
  };

  return (
    <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/3 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
        <span className="text-sm font-medium text-slate-200 flex-1">{tool.displayName}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catStyle}`}>
          {tool.category}
        </span>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-white/5 px-3 py-3 space-y-3"
        >
          <p className="text-xs text-slate-400">{tool.description}</p>

          {/* Inputs */}
          <div className="space-y-2">
            {Object.entries(tool.inputSchema.properties).map(([field, schema]) => (
              <div key={field}>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  {field}
                  {tool.inputSchema.required.includes(field) && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                </label>
                {schema.enum ? (
                  <select
                    value={inputs[field] || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 outline-none"
                  >
                    <option value="">— choose —</option>
                    {schema.enum.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    value={inputs[field] || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, [field]: e.target.value }))}
                    placeholder={schema.description}
                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-amber-500/50"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Running…' : 'Run Tool'}
          </button>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-3 text-xs font-mono border ${
              result.success
                ? 'bg-emerald-900/10 border-emerald-500/20 text-emerald-300'
                : 'bg-red-900/10 border-red-500/20 text-red-300'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success
                  ? <CheckCircle2 size={12} className="text-emerald-400" />
                  : <AlertCircle size={12} className="text-red-400" />
                }
                <span className="text-[10px]">{result.time}ms</span>
              </div>
              <pre className="whitespace-pre-wrap break-words leading-relaxed">{result.output}</pre>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
