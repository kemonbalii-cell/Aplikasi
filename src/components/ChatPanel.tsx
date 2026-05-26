import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useStore, selectCurrentSession, selectCurrentMessages } from '../store';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';

export function ChatPanel() {
  const currentSession = useStore(selectCurrentSession);
  const currentMessages = useStore(selectCurrentMessages);
  const streamingMessageId = useStore((s) => s.streamingMessageId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, streamingMessageId]);

  if (!currentSession) {
    return (
      <div className="flex flex-col h-full">
        <WelcomeScreen />
        <InputBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={16} className="text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200 truncate">
            {currentSession.title}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 shrink-0">
          <span className="font-mono">{currentSession.model}</span>
          {currentSession.totalCost > 0 && (
            <span>${currentSession.totalCost.toFixed(4)}</span>
          )}
          <span>{currentMessages.length} msgs</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 scroll-smooth">
        {currentMessages.length === 0 ? (
          <EmptyChat />
        ) : (
          <>
            {currentMessages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLatest={i === currentMessages.length - 1}
              />
            ))}
            <div ref={bottomRef} className="h-4" />
          </>
        )}
      </div>

      {/* Input */}
      <InputBar />
    </div>
  );
}

function WelcomeScreen() {
  const { createSession, settings } = useStore();

  const starters = [
    'Explain quantum entanglement in simple terms',
    'Write a REST API in TypeScript with Express',
    'Analyze the pros and cons of microservices',
    'Help me debug this Python error: AttributeError',
    'Create a comprehensive SQL query optimization guide',
    'Design a scalable event-driven architecture',
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/50">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">ASTRA HERMES ULTRA</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm">
          Advanced multi-provider AI agent platform with persistent memory, tool system, and multi-agent orchestration.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {starters.map((text, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => {
              createSession();
              setTimeout(() => useStore.getState().sendUserMessage(text), 50);
            }}
            className="text-left p-3.5 rounded-xl bg-white/3 border border-white/8 hover:bg-white/8 hover:border-indigo-500/30 transition-all text-sm text-slate-300 hover:text-white leading-relaxed"
          >
            {text}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-slate-600">
        <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Send a message to begin</p>
      </div>
    </div>
  );
}
