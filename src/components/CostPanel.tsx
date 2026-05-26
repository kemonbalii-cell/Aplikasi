import { motion } from 'motion/react';
import { BarChart3, Trash2, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { useStore } from '../store';
import type { Provider } from '../types';

const PROVIDER_COLORS: Record<Provider, string> = {
  claude:  '#a78bfa',
  openai:  '#34d399',
  ollama:  '#60a5fa',
  google:  '#f59e0b',
};

export function CostPanel() {
  const { costRecords, sessions, clearCosts } = useStore();

  const totalCost = costRecords.reduce((s, r) => s + r.cost, 0);
  const totalTokens = costRecords.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);

  const byProvider: Record<string, { cost: number; tokens: number; calls: number }> = {};
  costRecords.forEach((r) => {
    if (!byProvider[r.provider]) byProvider[r.provider] = { cost: 0, tokens: 0, calls: 0 };
    byProvider[r.provider].cost += r.cost;
    byProvider[r.provider].tokens += r.inputTokens + r.outputTokens;
    byProvider[r.provider].calls++;
  });

  const bySession: Record<string, { cost: number; calls: number; title: string }> = {};
  costRecords.forEach((r) => {
    const session = sessions.find((s) => s.id === r.sessionId);
    if (!bySession[r.sessionId]) {
      bySession[r.sessionId] = { cost: 0, calls: 0, title: session?.title || 'Unknown' };
    }
    bySession[r.sessionId].cost += r.cost;
    bySession[r.sessionId].calls++;
  });

  const topSessions = Object.entries(bySession)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5);

  // Last 7 days usage
  const now = Date.now();
  const days: { label: string; cost: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86_400_000);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86_400_000;
    const cost = costRecords
      .filter((r) => r.timestamp >= dayStart && r.timestamp < dayEnd)
      .reduce((s, r) => s + r.cost, 0);
    return { label, cost };
  });
  const maxDay = Math.max(...days.map((d) => d.cost), 0.001);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">Analytics</span>
        </div>
        {costRecords.length > 0 && (
          <button
            onClick={clearCosts}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <DollarSign size={12} />
              Total Cost
            </div>
            <p className="text-xl font-black text-white font-mono">${totalCost.toFixed(4)}</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <Zap size={12} />
              Total Tokens
            </div>
            <p className="text-xl font-black text-white font-mono">{totalTokens.toLocaleString()}</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <TrendingUp size={12} />
              API Calls
            </div>
            <p className="text-xl font-black text-white font-mono">{costRecords.length}</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <BarChart3 size={12} />
              Avg / Call
            </div>
            <p className="text-xl font-black text-white font-mono">
              ${costRecords.length ? (totalCost / costRecords.length).toFixed(5) : '0.00'}
            </p>
          </div>
        </div>

        {/* Daily chart */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3">Daily Usage (7d)</p>
          <div className="flex items-end gap-2 h-20">
            {days.map((d, i) => (
              <motion.div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full flex items-end justify-center" style={{ height: 60 }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.cost / maxDay) * 100}%` }}
                    transition={{ delay: i * 0.05 }}
                    className="w-full rounded-t-sm bg-gradient-to-t from-indigo-700 to-indigo-400 min-h-[2px]"
                    style={{ minHeight: d.cost > 0 ? 4 : 2 }}
                  />
                </div>
                <span className="text-[9px] text-slate-600">{d.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* By provider */}
        {Object.keys(byProvider).length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3">By Provider</p>
            <div className="space-y-2">
              {Object.entries(byProvider)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([provider, stats]) => (
                  <div key={provider} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PROVIDER_COLORS[provider as Provider] || '#64748b' }}
                    />
                    <span className="text-xs text-slate-300 capitalize w-16">{provider}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.cost / totalCost) * 100}%` }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: PROVIDER_COLORS[provider as Provider] || '#64748b' }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-16 text-right">
                      ${stats.cost.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-slate-600 w-10 text-right">{stats.calls}x</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Top sessions */}
        {topSessions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-3">Top Sessions</p>
            <div className="space-y-2">
              {topSessions.map(([, stats]) => (
                <div key={stats.title} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 flex-1 truncate">{stats.title}</span>
                  <span className="text-xs font-mono text-slate-300">${stats.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {costRecords.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-xs">
            <BarChart3 size={24} className="mx-auto mb-2 opacity-30" />
            No cost data yet.<br />Start chatting to track usage.
          </div>
        )}
      </div>
    </div>
  );
}
