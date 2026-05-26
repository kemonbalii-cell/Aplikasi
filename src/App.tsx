import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Brain, Wrench, BarChart3, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { MemoryPanel } from './components/MemoryPanel';
import { AgentPanel } from './components/AgentPanel';
import { ToolsPanel } from './components/ToolsPanel';
import { CostPanel } from './components/CostPanel';
import { SettingsPanel } from './components/SettingsPanel';

const RIGHT_PANEL_TABS = [
  { id: 'memory' as const,  icon: Database, label: 'Memory',  color: 'text-emerald-400' },
  { id: 'agents' as const,  icon: Brain,    label: 'Agents',  color: 'text-violet-400' },
  { id: 'tools'  as const,  icon: Wrench,   label: 'Tools',   color: 'text-amber-400' },
  { id: 'cost'   as const,  icon: BarChart3, label: 'Stats',  color: 'text-sky-400' },
];

export default function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const activeView = useStore((s) => s.activeView);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);
  const rightPanelTab = useStore((s) => s.rightPanelTab);
  const sessions = useStore((s) => s.sessions);
  const { setRightPanel, createSession } = useStore();

  // Create a default session on first load
  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, []);

  const showRightPanel = activeView === 'chat' && rightPanelOpen;
  const leftOffset = sidebarOpen ? 256 : 0;

  const renderMainContent = () => {
    switch (activeView) {
      case 'chat':     return <ChatPanel />;
      case 'memory':   return <MemoryPanel />;
      case 'agents':   return <AgentPanel />;
      case 'tools':    return <ToolsPanel />;
      case 'cost':     return <CostPanel />;
      case 'settings': return <SettingsPanel />;
      default:         return <ChatPanel />;
    }
  };

  const renderRightPanelContent = () => {
    switch (rightPanelTab) {
      case 'memory':  return <MemoryPanel />;
      case 'agents':  return <AgentPanel />;
      case 'tools':   return <ToolsPanel />;
      case 'cost':    return <CostPanel />;
      default:        return <AgentPanel />;
    }
  };

  return (
    <div className="h-screen flex bg-[#080812] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <motion.main
        className="flex flex-1 overflow-hidden"
        animate={{ marginLeft: leftOffset }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Primary content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeView === 'chat' && (
            <div className="flex items-center gap-2 justify-end px-4 py-2 border-b border-white/5 bg-[#0a0a14]/80 backdrop-blur-sm shrink-0">
              {RIGHT_PANEL_TABS.map(({ id, icon: Icon, label, color }) => (
                <button
                  key={id}
                  onClick={() => setRightPanel(rightPanelTab === id && rightPanelOpen ? false : true, id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                    rightPanelTab === id && rightPanelOpen
                      ? 'bg-white/10 text-white'
                      : `text-slate-500 hover:text-slate-300 hover:bg-white/5`
                  }`}
                >
                  <Icon size={13} className={rightPanelTab === id && rightPanelOpen ? color : ''} />
                  {label}
                </button>
              ))}
              {rightPanelOpen && (
                <button
                  onClick={() => setRightPanel(false)}
                  className="p-1 text-slate-500 hover:text-slate-300 ml-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderMainContent()}
          </div>
        </div>

        {/* Right panel */}
        <AnimatePresence>
          {showRightPanel && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="border-l border-white/5 bg-[#0a0a14] shrink-0 overflow-hidden"
              style={{ width: 360 }}
            >
              <div className="w-[360px] h-full overflow-hidden">
                {renderRightPanelContent()}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}
