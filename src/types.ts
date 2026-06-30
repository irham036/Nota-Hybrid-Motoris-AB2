export interface Product {
  name: string;
  price: number;
  conv: number; // Jumlah unitSdg dalam 1 Q (e.g. 1Q = 4 Rcg)
  unitBsr: string; // Label Besar, e.g. "Q"
  unitSdg: string; // Label Unit Kecil, e.g. "Rcg", "Zak", "Box", "Pcs"
}

export interface TransactionItem {
  id: string;
  name: string;
  price: number;
  loadingBsr: number; // Input muatan Q
  loadingSdg: number; // Input muatan unitSdg (Rcg/Zak/Box/Pcs etc)
  loading: number; // Total loading dalam unitSdg
  qtyBsr: number; // Sales input Q
  qtySdg: number; // Sales input unitSdg (Rcg/Zak/Box/Pcs etc)
  qty: number; // Total sold dalam unitSdg
  retur: number; // Sisa / Retur (loading - qty) dalam unitSdg
}

export interface HistoryItem {
  name: string;
  price: number;
  loading: number;
  qty: number;
  retur: number;
}

export interface HistoryRecord {
  id: string;
  date: string; // YYYY-MM-DD formatted or readable
  rawDate?: string; // Original YYYY-MM-DD ISO string
  salesName: string;
  tokoName: string;
  items: HistoryItem[];
  timestamp: number;
  isLoadingRecord?: boolean;
}


