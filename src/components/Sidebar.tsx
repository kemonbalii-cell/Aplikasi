import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Plus, MessageSquare, Database, Brain, Wrench,
  Settings, BarChart3, Search, Pin, Trash2, ChevronLeft, ChevronRight,
  DollarSign,
} from 'lucide-react';
import { useStore } from '../store';
import type { View } from '../types';

const NAV_ITEMS: { view: View; icon: typeof Settings; label: string; color: string }[] = [
  { view: 'chat',     icon: MessageSquare, label: 'Chat',     color: 'text-indigo-400' },
  { view: 'memory',   icon: Database,      label: 'Memory',   color: 'text-emerald-400' },
  { view: 'agents',   icon: Brain,         label: 'Agents',   color: 'text-violet-400' },
  { view: 'tools',    icon: Wrench,        label: 'Tools',    color: 'text-amber-400' },
  { view: 'cost',     icon: BarChart3,     label: 'Analytics',color: 'text-sky-400' },
  { view: 'settings', icon: Settings,      label: 'Settings', color: 'text-slate-400' },
];

export function Sidebar() {
  const {
    sessions, currentSessionId, sidebarOpen,
    createSession, selectSession, deleteSession, pinSession,
    activeView, setActiveView, setSidebarOpen, costRecords,
  } = useStore();

  const [search, setSearch] = useState('');

  const totalCost = costRecords.reduce((s, r) => s + r.cost, 0);

  const filtered = sessions
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  return (
    <>
      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-1.5 rounded-lg bg-[#1a1a2e] border border-white/10 text-slate-400 hover:text-white transition-colors"
        style={{ left: sidebarOpen ? '252px' : '12px' }}
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 h-full w-64 bg-[#0a0a14] border-r border-white/5 flex flex-col z-40"
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-black text-white tracking-tight leading-none">ASTRA</div>
                <div className="text-[9px] text-indigo-400 font-mono tracking-widest">HERMES ULTRA</div>
              </div>
            </div>

            {/* Nav */}
            <nav className="px-3 py-3 border-b border-white/5 space-y-0.5">
              {NAV_ITEMS.map(({ view, icon: Icon, label, color }) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                    activeView === view
                      ? 'bg-white/8 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                  }`}
                >
                  <Icon size={16} className={activeView === view ? color : ''} />
                  {label}
                </button>
              ))}
            </nav>

            {/* New chat + search */}
            <div className="px-3 pt-3 space-y-2">
              <button
                onClick={() => {
                  createSession();
                  setActiveView('chat');
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-98"
              >
                <Plus size={16} />
                New Chat
              </button>

              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats…"
                  className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/8 rounded-xl text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
              {filtered.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-xs">
                  {search ? 'No results' : 'No chats yet'}
                </div>
              )}
              {filtered.map((session) => (
                <div
                  key={session.id}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                    currentSessionId === session.id
                      ? 'bg-white/8 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                  }`}
                  onClick={() => {
                    selectSession(session.id);
                    setActiveView('chat');
                  }}
                >
                  {session.isPinned && <Pin size={10} className="text-amber-400 shrink-0" />}
                  <span className="flex-1 text-xs truncate leading-relaxed">{session.title}</span>
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); pinSession(session.id, !session.isPinned); }}
                      className="p-1 hover:text-amber-400 rounded transition-colors"
                    >
                      <Pin size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="p-1 hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer cost */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <DollarSign size={12} />
                <span>Total spent</span>
              </div>
              <span className="text-xs font-mono text-slate-300">${totalCost.toFixed(4)}</span>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
