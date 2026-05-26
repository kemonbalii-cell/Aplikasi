import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Search, Plus, Trash2, Download, Upload, X } from 'lucide-react';
import {
  getMemories, addMemory, deleteMemory, searchMemory,
  getMemoryStats, exportMemory, importMemory,
} from '../memory';
import type { MemoryEntry, MemoryLayer } from '../types';

const LAYERS: { id: MemoryLayer; label: string; color: string }[] = [
  { id: 'session',   label: 'Session',   color: 'bg-blue-500' },
  { id: 'project',   label: 'Project',   color: 'bg-indigo-500' },
  { id: 'global',    label: 'Global',    color: 'bg-violet-500' },
  { id: 'strategy',  label: 'Strategy',  color: 'bg-amber-500' },
  { id: 'tool',      label: 'Tool',      color: 'bg-orange-500' },
  { id: 'knowledge', label: 'Knowledge', color: 'bg-emerald-500' },
];

export function MemoryPanel() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [layer, setLayer] = useState<MemoryLayer | 'all'>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<MemoryLayer, number>>({} as never);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => {
    const results = search.trim()
      ? searchMemory(search, 50)
      : getMemories(layer === 'all' ? undefined : layer);
    setEntries(results);
    setStats(getMemoryStats());
  };

  useEffect(() => { refresh(); }, [layer, search]);

  const handleDelete = (id: string) => {
    deleteMemory(id);
    refresh();
  };

  const handleExport = () => {
    const json = exportMemory();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astra-memory-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const count = importMemory(ev.target?.result as string);
          alert(`Imported ${count} memories`);
          refresh();
        } catch {
          alert('Invalid file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Memory</span>
          <span className="text-xs text-slate-500">{entries.length} entries</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleImport} title="Import" className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5">
            <Upload size={14} />
          </button>
          <button onClick={handleExport} title="Export" className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5">
            <Download size={14} />
          </button>
          <button onClick={() => setAddOpen(true)} className="p-1.5 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-white/5">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/8 rounded-xl text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Layer tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5 scrollbar-none">
        <button
          onClick={() => setLayer('all')}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            layer === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          All ({Object.values(stats).reduce((a, b) => a + b, 0)})
        </button>
        {LAYERS.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setLayer(id)}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              layer === id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
            {label} ({stats[id] || 0})
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {entries.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-xs">
            <Database size={24} className="mx-auto mb-2 opacity-30" />
            No memories found
          </div>
        )}
        {entries.map((entry) => {
          const layerInfo = LAYERS.find((l) => l.id === entry.layer);
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group bg-white/3 border border-white/8 rounded-xl p-3 hover:border-white/15 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${layerInfo?.color || 'bg-slate-500'}`} />
                  <span className="text-[11px] font-mono text-slate-300 truncate">{entry.key}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-600">×{entry.accessCount}</span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-3">
                {entry.content}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {/* Importance bar */}
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                    style={{ width: `${entry.importance * 10}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-600">{entry.importance}/10</span>
                {entry.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Memory Modal */}
      <AnimatePresence>
        {addOpen && (
          <AddMemoryModal onClose={() => { setAddOpen(false); refresh(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddMemoryModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState('');
  const [content, setContent] = useState('');
  const [layer, setLayer] = useState<MemoryLayer>('project');
  const [importance, setImportance] = useState(5);
  const [tags, setTags] = useState('');

  const handleSave = () => {
    if (!key.trim() || !content.trim()) return;
    addMemory(layer, key.trim(), content.trim(), importance, tags.split(',').map((t) => t.trim()).filter(Boolean));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white text-sm">Add Memory</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
        </div>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key / identifier"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/50"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Content to remember…"
          rows={4}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/50 resize-none"
        />
        <div className="flex gap-3">
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as MemoryLayer)}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 outline-none"
          >
            {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Imp</span>
            <input
              type="range"
              min={1}
              max={10}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-slate-300 w-4">{importance}</span>
          </div>
        </div>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma separated)"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Save Memory
        </button>
      </motion.div>
    </motion.div>
  );
}
