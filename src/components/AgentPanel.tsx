import { motion } from 'motion/react';
import { Brain, CheckCircle2, Loader2, AlertCircle, Clock, DollarSign, SkipForward } from 'lucide-react';
import { useStore } from '../store';
import { AGENT_CONFIGS } from '../agents';
import type { AgentStep } from '../types';

export function AgentPanel() {
  const { pipelines, currentSessionId, settings, updateSettings } = useStore();

  const currentPipelines = pipelines
    .filter((p) => p.sessionId === currentSessionId)
    .slice(-5)
    .reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Brain size={16} className="text-violet-400" />
        <span className="text-sm font-semibold text-slate-200">Agent Pipeline</span>
      </div>

      {/* Agent toggles */}
      <div className="px-3 py-3 border-b border-white/5 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Active Agents</p>
        {AGENT_CONFIGS.map((agent) => {
          const isEnabled = settings.enabledAgents.includes(agent.role);
          return (
            <button
              key={agent.role}
              onClick={() => {
                const next = isEnabled
                  ? settings.enabledAgents.filter((r) => r !== agent.role)
                  : [...settings.enabledAgents, agent.role];
                updateSettings({ enabledAgents: next });
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                isEnabled ? 'bg-white/5 border border-white/10' : 'border border-transparent opacity-40'
              } hover:opacity-100`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: agent.color }}
              />
              <span className={`font-medium ${isEnabled ? 'text-slate-200' : 'text-slate-500'}`}>
                {agent.name}
              </span>
              <span className="text-slate-600 truncate flex-1">{agent.description}</span>
              <span className={`shrink-0 w-8 text-right text-[10px] ${isEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                {isEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pipeline history */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
        {currentPipelines.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-xs">
            <Brain size={24} className="mx-auto mb-2 opacity-30" />
            No pipelines yet for this session
          </div>
        )}
        {currentPipelines.map((pipeline) => (
          <div key={pipeline.id} className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
            {/* Pipeline header */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/3 border-b border-white/5">
              <span className="text-xs text-slate-300 truncate flex-1">{pipeline.userMessage.slice(0, 60)}{pipeline.userMessage.length > 60 ? '…' : ''}</span>
              <PipelineStatusBadge status={pipeline.status} />
            </div>

            {/* Duration + cost */}
            {pipeline.endTime && (
              <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-slate-500 border-b border-white/5">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {((pipeline.endTime - pipeline.startTime) / 1000).toFixed(1)}s
                </span>
                {pipeline.totalCost > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign size={10} />
                    ${pipeline.totalCost.toFixed(5)}
                  </span>
                )}
                <span>{pipeline.totalTokens.toLocaleString()} tokens</span>
              </div>
            )}

            {/* Steps */}
            <div className="p-3 space-y-2">
              {pipeline.steps.map((step, i) => (
                <AgentStepRow key={i} step={step} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentStepRow({ step, index }: { step: AgentStep; index: number }) {
  const agentConfig = AGENT_CONFIGS.find((a) => a.role === step.agentRole);
  const duration = step.startTime && step.endTime
    ? ((step.endTime - step.startTime) / 1000).toFixed(1) + 's'
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-2.5"
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {step.status === 'running' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
        {step.status === 'done' && <CheckCircle2 size={14} className="text-emerald-400" />}
        {step.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
        {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
        {step.status === 'skipped' && <SkipForward size={14} className="text-slate-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold"
            style={{ color: agentConfig?.color || '#94a3b8' }}
          >
            {agentConfig?.name || step.agentRole}
          </span>
          {duration && <span className="text-[10px] text-slate-600">{duration}</span>}
          {step.cost && step.cost > 0 && (
            <span className="text-[10px] text-slate-600">${step.cost.toFixed(5)}</span>
          )}
        </div>
        {step.status === 'running' && (
          <div className="mt-1 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 bg-amber-400 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}
        {step.output && step.status === 'done' && (
          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {step.output.slice(0, 120)}{step.output.length > 120 ? '…' : ''}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function PipelineStatusBadge({ status }: { status: string }) {
  const config = {
    pending:  { color: 'bg-slate-700 text-slate-300', label: 'Pending' },
    running:  { color: 'bg-amber-900/50 text-amber-400', label: 'Running' },
    done:     { color: 'bg-emerald-900/50 text-emerald-400', label: 'Done' },
    error:    { color: 'bg-red-900/50 text-red-400', label: 'Error' },
  }[status] || { color: 'bg-slate-700 text-slate-300', label: status };

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}
