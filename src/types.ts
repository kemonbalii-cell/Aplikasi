export interface Transaction {
  id: string;
  type: 'masuk' | 'jual' | 'busuk' | 'shrink';
  tanggal: string;
  kg: number;
  hargaPerKg: number;
  total: number;
  keterangan?: string; // supplier for masuk, pelanggan for jual, alasan for busuk/shrink
  profit?: number;
  kerugian?: number;
}

export interface LemonStok {
  baik: number;
  busuk: number;
  totalKg: number;
}

export interface LemonDatabase {
  modalAwal: number;
  modalSisa: number;
  transactions: Transaction[];
  stok: LemonStok;
}
