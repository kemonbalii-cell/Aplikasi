import { useState, useEffect, useMemo } from 'react';
import { LemonDatabase, Transaction, LemonStok } from './types.ts';

const INITIAL_MODAL = 10000000; // 10 Juta

export function useLemonStore() {
  const [db, setDb] = useState<LemonDatabase>(() => {
    const saved = localStorage.getItem('lemon_db');
    if (saved) return JSON.parse(saved);
    return {
      modalAwal: INITIAL_MODAL,
      modalSisa: INITIAL_MODAL,
      transactions: [],
      stok: {
        baik: 0,
        busuk: 0,
        totalKg: 0
      }
    };
  });

  useEffect(() => {
    localStorage.setItem('lemon_db', JSON.stringify(db));
  }, [db]);

  const hitungHargaBeliRata = useMemo(() => {
    const masuk = db.transactions.filter(t => t.type === 'masuk');
    if (masuk.length === 0) return 0;
    const totalKg = masuk.reduce((acc, curr) => acc + curr.kg, 0);
    const totalHarga = masuk.reduce((acc, curr) => acc + curr.total, 0);
    return totalKg > 0 ? totalHarga / totalKg : 0;
  }, [db.transactions]);

  const stats = useMemo(() => {
    const profitTotal = db.transactions
      .filter(t => t.type === 'jual')
      .reduce((acc, curr) => acc + (curr.profit || 0), 0);
    
    const kerugianTotal = db.transactions
      .filter(t => t.type === 'busuk' || t.type === 'shrink')
      .reduce((acc, curr) => acc + (curr.kerugian || 0), 0);

    return {
      profitTotal,
      kerugianTotal,
      totalMasuk: db.transactions.filter(t => t.type === 'masuk').reduce((acc, curr) => acc + curr.kg, 0),
      totalJual: db.transactions.filter(t => t.type === 'jual').reduce((acc, curr) => acc + curr.kg, 0),
      totalBusuk: db.transactions.filter(t => t.type === 'busuk').reduce((acc, curr) => acc + curr.kg, 0),
      totalShrink: db.transactions.filter(t => t.type === 'shrink').reduce((acc, curr) => acc + curr.kg, 0),
    };
  }, [db.transactions]);

  const addTransaction = (type: Transaction['type'], kg: number, harga: number, keterangan: string) => {
    const total = kg * harga;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    setDb(prev => {
      let newModalSisa = prev.modalSisa;
      let newStokBaik = prev.stok.baik;
      let newStokBusuk = prev.stok.busuk;
      let newStokTotalKg = prev.stok.totalKg;
      let profit = 0;
      let kerugian = 0;

      if (type === 'masuk') {
        if (total > prev.modalSisa) {
            alert('Modal tidak cukup!');
            return prev;
        }
        newModalSisa -= total;
        newStokBaik += kg;
        newStokTotalKg += kg;
      } else if (type === 'jual') {
        if (kg > prev.stok.baik) {
            alert('Stok tidak cukup!');
            return prev;
        }
        newModalSisa += total;
        newStokBaik -= kg;
        newStokTotalKg -= kg;
        profit = (harga - hitungHargaBeliRata) * kg;
      } else if (type === 'busuk') {
        if (kg > prev.stok.baik) {
            alert('Stok tidak cukup!');
            return prev;
        }
        newStokBaik -= kg;
        newStokBusuk += kg;
        kerugian = hitungHargaBeliRata * kg;
      } else if (type === 'shrink') {
        if (kg > prev.stok.baik) {
            alert('Stok tidak cukup!');
            return prev;
        }
        newStokBaik -= kg;
        newStokTotalKg -= kg;
        kerugian = hitungHargaBeliRata * kg;
      }

      const newTransaction: Transaction = {
        id,
        type,
        tanggal: now,
        kg,
        hargaPerKg: harga,
        total,
        keterangan,
        profit,
        kerugian
      };

      return {
        ...prev,
        modalSisa: newModalSisa,
        stok: {
          baik: newStokBaik,
          busuk: newStokBusuk,
          totalKg: newStokTotalKg
        },
        transactions: [newTransaction, ...prev.transactions]
      };
    });
    return true;
  };

  const resetData = () => {
    if (window.confirm('Hapus semua data?')) {
        setDb({
            modalAwal: INITIAL_MODAL,
            modalSisa: INITIAL_MODAL,
            transactions: [],
            stok: { baik: 0, busuk: 0, totalKg: 0 }
        });
    }
  };

  return {
    db,
    stats,
    addTransaction,
    resetData,
    hargaBeliRata: hitungHargaBeliRata
  };
}
