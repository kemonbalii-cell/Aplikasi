import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Package, 
  Trash2, 
  ShoppingBag, 
  History, 
  FileText, 
  Plus, 
  ArrowRightLeft,
  X,
  RefreshCcw,
  AlertTriangle
} from 'lucide-react';
import { useLemonStore } from './useLemonStore';
import { Transaction } from './types';

// Utility for currency formatting
const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

// Form Dialog Component
const TransactionForm = ({ 
  type, 
  onClose, 
  onSubmit 
}: { 
  type: Transaction['type'], 
  onClose: () => void, 
  onSubmit: (kg: number, harga: number, ket: string) => void 
}) => {
  const [kg, setKg] = useState('');
  const [harga, setHarga] = useState('');
  const [ket, setKet] = useState('');

  const titles = {
    masuk: 'Lemon Masuk (Stok Baru)',
    jual: 'Penjualan Lemon',
    busuk: 'Lemon Busuk (Waste)',
    shrink: 'Penyusutan (Shrinkage)'
  };

  const placeholders = {
    masuk: 'Nama Supplier',
    jual: 'Nama Pelanggan',
    busuk: 'Alasan (misal: suhu tinggi)',
    shrink: 'Alasan (misal: penguapan)'
  };

  const labels = {
    masuk: 'Harga Beli / kg',
    jual: 'Harga Jual / kg',
    busuk: 'Estimasi Kerugian / kg (Auto)',
    shrink: 'Estimasi Kerugian / kg (Auto)'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(Number(kg), Number(harga || 0), ket);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-yellow-400 p-6 flex justify-between items-center text-yellow-950">
          <h3 className="font-bold text-xl">{titles[type]}</h3>
          <button onClick={onClose} className="p-2 hover:bg-yellow-500 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Kilogram)</label>
            <input 
              required
              type="number" 
              step="0.01"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
            />
          </div>
          {(type === 'masuk' || type === 'jual') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{labels[type]}</label>
              <input 
                required
                type="number" 
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="Rp 0"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{placeholders[type]}</label>
            <input 
              required
              type="text" 
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              placeholder="..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold rounded-xl shadow-lg transition-all active:scale-95"
          >
            SIMPAN DATA
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const { db, stats, addTransaction, resetData, hargaBeliRata } = useLemonStore();
  const [activeForm, setActiveForm] = useState<Transaction['type'] | null>(null);
  const [view, setView] = useState<'dashboard' | 'history' | 'report'>('dashboard');

  const handleFormSubmit = (kg: number, harga: number, ket: string) => {
    if (addTransaction(activeForm!, kg, harga, ket)) {
      setActiveForm(null);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 text-gray-900 font-sans selection:bg-yellow-200">
      {/* Header */}
      <header className="bg-yellow-400 p-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-2xl shadow-inner">
              <span className="text-3xl">🍋</span>
            </div>
            <h1 className="text-2xl font-black text-yellow-950 tracking-tight">LEMON SALES</h1>
          </div>
          <button 
            onClick={resetData}
            className="p-2 hover:bg-yellow-500 rounded-lg text-yellow-950 transition-colors"
          >
            <RefreshCcw size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-24 space-y-6">
        
        {view === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-yellow-100 flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-gray-400 tracking-wider">MODAL SISA</span>
                <span className="text-xl font-black text-yellow-600">{formatRupiah(db.modalSisa)}</span>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-yellow-100 flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-gray-400 tracking-wider">STOK BAIK</span>
                <span className="text-xl font-black text-green-600">{db.stok.baik.toFixed(1)} kg</span>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-yellow-100 flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-gray-400 tracking-wider">PROFIT BERSIH</span>
                <span className="text-xl font-black text-blue-600">{formatRupiah(stats.profitTotal)}</span>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-yellow-100 flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-gray-400 tracking-wider">HARGA BELI MODAL</span>
                <span className="text-base font-bold text-gray-600">{formatRupiah(hargaBeliRata)} /kg</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-400 ml-2 tracking-widest uppercase">Input Data</h2>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setActiveForm('masuk')}
                  className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 hover:border-yellow-400 transition-all shadow-sm active:scale-95"
                >
                  <div className="bg-green-100 p-2 rounded-xl text-green-600"><Plus size={20}/></div>
                  <span className="font-bold">Barang Masuk</span>
                </button>
                <button 
                  onClick={() => setActiveForm('jual')}
                  className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 hover:border-yellow-400 transition-all shadow-sm active:scale-95"
                >
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><ShoppingBag size={20}/></div>
                  <span className="font-bold">Jual Lemon</span>
                </button>
                <button 
                  onClick={() => setActiveForm('busuk')}
                  className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 hover:border-yellow-400 transition-all shadow-sm active:scale-95"
                >
                  <div className="bg-red-100 p-2 rounded-xl text-red-600"><Trash2 size={20}/></div>
                  <span className="font-bold">Lemon Busuk</span>
                </button>
                <button 
                  onClick={() => setActiveForm('shrink')}
                  className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 hover:border-yellow-400 transition-all shadow-sm active:scale-95"
                >
                  <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><TrendingUp size={20}/></div>
                  <span className="font-bold">Penyusutan</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
             <h2 className="text-lg font-black text-yellow-900 mb-2">Riwayat Transaksi</h2>
             {db.transactions.length === 0 ? (
               <div className="bg-white p-12 rounded-3xl text-center text-gray-400 shadow-sm border border-yellow-100">
                 <History size={48} className="mx-auto mb-4 opacity-20" />
                 <p>Belum ada transaksi</p>
               </div>
             ) : (
                db.transactions.map((t) => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                      <div className={`p-3 rounded-xl ${
                        t.type === 'masuk' ? 'bg-green-100 text-green-600' :
                        t.type === 'jual' ? 'bg-blue-100 text-blue-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {t.type === 'masuk' ? <Plus size={18}/> : t.type === 'jual' ? <ShoppingBag size={18}/> : <Trash2 size={18}/>}
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase tracking-wide">{t.type} - {t.kg}kg</p>
                        <p className="text-xs text-gray-400">{new Date(t.tanggal).toLocaleString('id-ID')}</p>
                        <p className="text-xs font-medium text-gray-600 mt-1 italic">"{t.keterangan}"</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm">{formatRupiah(t.total)}</p>
                      {t.profit && t.profit > 0 && <p className="text-[10px] font-bold text-blue-500">Margin: +{formatRupiah(t.profit)}</p>}
                      {t.kerugian && t.kerugian > 0 && <p className="text-[10px] font-bold text-red-500">Rugi: -{formatRupiah(t.kerugian)}</p>}
                    </div>
                  </div>
                ))
             )}
          </motion.div>
        )}

        {view === 'report' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <h2 className="text-lg font-black text-yellow-900 mb-2">Laporan Keuangan</h2>
            
            <div className="bg-white rounded-3xl shadow-sm border border-yellow-100 overflow-hidden">
               <div className="bg-yellow-400 p-4 font-black">RINGKASAN</div>
               <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                    <span className="text-gray-500 font-medium">Modal Awal</span>
                    <span className="font-bold">{formatRupiah(db.modalAwal)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2 text-green-600">
                    <span className="font-medium">Total Profit Penjualan</span>
                    <span className="font-bold">+{formatRupiah(stats.profitTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2 text-red-600">
                    <span className="font-medium">Total Kerugian (Busuk/Shrink)</span>
                    <span className="font-bold">-{formatRupiah(stats.kerugianTotal)}</span>
                  </div>
                  <div className="pt-2">
                    <div className="p-4 rounded-2xl bg-yellow-400 text-yellow-950 flex justify-between items-center">
                      <span className="font-black">ASSET BERSIH</span>
                      <span className="text-xl font-black">{formatRupiah(db.modalSisa + (db.stok.baik * hargaBeliRata))}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">*(Sisa Kas + Valuasi Stok Berjalan)</p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-yellow-100 overflow-hidden">
               <div className="bg-gray-100 p-4 font-black text-gray-600 text-xs tracking-widest uppercase">Volume Barang</div>
               <div className="p-6 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1">DIBELI</p>
                    <p className="text-xl font-black text-green-500">{stats.totalMasuk} kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1">TERJUAL</p>
                    <p className="text-xl font-black text-blue-500">{stats.totalJual} kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1">BUSUK</p>
                    <p className="text-xl font-black text-red-500">{stats.totalBusuk} kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold mb-1">SHRINK</p>
                    <p className="text-xl font-black text-orange-500">{stats.totalShrink} kg</p>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto bg-white/80 backdrop-blur-md border-t border-yellow-100 p-4 flex justify-around items-center z-40 rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        <button 
          onClick={() => setView('dashboard')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-yellow-600 scale-110' : 'text-gray-400'}`}
        >
          <Package size={24} strokeWidth={view === 'dashboard' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Dash</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'history' ? 'text-yellow-600 scale-110' : 'text-gray-400'}`}
        >
          <History size={24} strokeWidth={view === 'history' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Logs</span>
        </button>
        <button 
          onClick={() => setView('report')}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'report' ? 'text-yellow-600 scale-110' : 'text-gray-400'}`}
        >
          <FileText size={24} strokeWidth={view === 'report' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Finance</span>
        </button>
      </nav>

      {/* Forms Overlay */}
      <AnimatePresence>
        {activeForm && (
          <TransactionForm 
            type={activeForm} 
            onClose={() => setActiveForm(null)}
            onSubmit={handleFormSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
