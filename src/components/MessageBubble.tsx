import { useState } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, ChevronDown, ChevronRight, Wrench, Brain, DollarSign } from 'lucide-react';
import type { Message } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

const AGENT_COLORS: Record<string, string> = {
  planner:    'text-blue-400',
  executor:   'text-amber-400',
  reviewer:   'text-red-400',
  researcher: 'text-emerald-400',
  debugger:   'text-orange-400',
  optimizer:  'text-sky-400',
  memory:     'text-lime-400',
  router:     'text-violet-400',
};

interface Props {
  message: Message;
  isLatest?: boolean;
}

export function MessageBubble({ message, isLatest }: Props) {
  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCost = (cost?: number) =>
    cost && cost > 0 ? `$${cost.toFixed(6)}` : null;

  const formatTokens = (i?: number, o?: number) =>
    i || o ? `${((i || 0) + (o || 0)).toLocaleString()} tokens` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold select-none ${
        isUser
          ? 'bg-indigo-600 text-white'
          : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white'
      }`}>
        {isUser ? 'U' : 'A'}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1.5 max-w-[85%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Agent role badge */}
        {message.agentRole && (
          <span className={`text-[10px] font-mono uppercase tracking-widest ${AGENT_COLORS[message.agentRole] || 'text-slate-400'}`}>
            {message.agentRole}
          </span>
        )}

        {/* Thinking disclosure */}
        {message.thinking && (
          <button
            onClick={() => setThinkingOpen(!thinkingOpen)}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Brain size={12} />
            {thinkingOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Internal reasoning
          </button>
        )}
        {thinkingOpen && message.thinking && (
          <div className="p-3 rounded-xl bg-violet-900/20 border border-violet-500/20 text-xs text-violet-300 font-mono max-w-lg">
            {message.thinking}
          </div>
        )}

        {/* Message bubble */}
        <div className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-[#1e2133] text-slate-100 rounded-tl-sm border border-white/5'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <>
              {message.isStreaming && !message.content ? (
                <StreamingDots />
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
              {message.isStreaming && message.content && (
                <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle rounded-sm" />
              )}
            </>
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls?.map((tc) => (
          <div key={tc.id} className="flex items-start gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/10 max-w-md w-full">
            <Wrench size={12} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-mono text-amber-300">{tc.toolName}</span>
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                tc.status === 'done' ? 'bg-green-900/50 text-green-400' :
                tc.status === 'error' ? 'bg-red-900/50 text-red-400' :
                'bg-amber-900/50 text-amber-400'
              }`}>
                {tc.status}
              </span>
              {tc.endTime && tc.startTime && (
                <span className="ml-2 text-slate-500">{tc.endTime - tc.startTime}ms</span>
              )}
            </div>
          </div>
        ))}

        {/* Meta row */}
        <div className={`flex items-center gap-3 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : ''}`}>
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.model && <span className="font-mono">{message.model}</span>}
          {formatTokens(message.inputTokens, message.outputTokens) && (
            <span>{formatTokens(message.inputTokens, message.outputTokens)}</span>
          )}
          {formatCost(message.cost) && (
            <span className="flex items-center gap-0.5">
              <DollarSign size={9} />
              {message.cost!.toFixed(5)}
            </span>
          )}
          {isAssistant && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StreamingDots() {
  return (
    <div className="flex gap-1.5 items-center py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-indigo-400 rounded-full"
          animate={{ y: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
