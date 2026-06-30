import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Download, 
  Send, 
  RefreshCw, 
  Calendar, 
  Store, 
  User, 
  AlertCircle,
  Check,
  Copy,
  FileText,
  Info,
  X,
  PlusCircle,
  Eye,
  Database,
  Truck,
  ArrowRight,
  ArrowLeft,
  Settings,
  TrendingUp,
  History,
  UserPlus,
  Edit,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Search,
  Box,
  Save,
  Share2,
  Camera,
  CheckCircle
} from "lucide-react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { MASTER_PRODUCTS } from "./data";
import { Product, TransactionItem, HistoryRecord, HistoryItem } from "./types";
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  findOrCreateSpreadsheet, 
  appendTransactionToSheet 
} from "./lib/googleSheets";
import { User as FirebaseUser } from "firebase/auth";
import {
  subscribeToHistory,
  saveHistoryToFirestore,
  deleteHistoryFromFirestore,
  subscribeToSalesPeople,
  updateSalesPeopleInFirestore,
  subscribeToProducts,
  updateProductsInFirestore
} from "./lib/firebase";

const SALES_OPTIONS = ["Rizky", "Iman", "Deden", "Cancan", "Martin", "Fikri", "Sabani", "Lukman"];

export default function App() {
  // Dynamic sales people state loaded from localStorage with default list
  const [salesPeople, setSalesPeople] = useState<string[]>(() => {
    const saved = localStorage.getItem("SALES_PEOPLE");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal membaca SALES_PEOPLE dari localStorage:", e);
      }
    }
    return ["Rizky", "Iman", "Deden", "Cancan", "Martin", "Fikri", "Sabani", "Lukman"];
  });

  // Local state
  const [activeMode, setActiveMode] = useState<"loading" | "penjualan">("loading");
  const [salesName, setSalesName] = useState(() => {
    const saved = localStorage.getItem("SALES_PEOPLE");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed[0];
      } catch (e) {}
    }
    return "Iman";
  });
  const [tokoName, setTokoName] = useState("TK PPJ");
  const [tanggal, setTanggal] = useState("");
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [lastLoadedKey, setLastLoadedKey] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expandedStrukSales, setExpandedStrukSales] = useState<string[]>([]);
  const [isEditingSavedPenjualan, setIsEditingSavedPenjualan] = useState(false);

  useEffect(() => {
    setIsEditingSavedPenjualan(false);
  }, [salesName, tokoName, tanggal]);

  // Pop-up input muatan (loading) states
  const [showMuatanPopup, setShowMuatanPopup] = useState(false);
  const [muatanPopupSales, setMuatanPopupSales] = useState("");
  const [muatanPopupDate, setMuatanPopupDate] = useState("");
  const [muatanPopupItems, setMuatanPopupItems] = useState<{
    name: string;
    price: number;
    loadingBsr: number;
    loadingSdg: number;
    loading: number;
  }[]>([]);
  const [muatanPopupSearch, setMuatanPopupSearch] = useState("");
  const [activePopupProducts, setActivePopupProducts] = useState<string[]>([]);
  const [isSavingMuatan, setIsSavingMuatan] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "warning" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"transaksi" | "histori" | "metrics">("transaksi");

  // Manage salespeople modal state
  const [showSalesSettings, setShowSalesSettings] = useState(false);
  const [newSalesName, setNewSalesName] = useState("");
  const [editingSalesIndex, setEditingSalesIndex] = useState<number | null>(null);
  const [editingSalesName, setEditingSalesName] = useState("");

  // History database state
  const [historySuccess, setHistorySuccess] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(() => {
    const saved = localStorage.getItem("SALES_HISTORY");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal membaca SALES_HISTORY dari localStorage:", e);
      }
    }
    return [];
  });

  // Selected history record for modal detail view
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<"semua" | "loading" | "penjualan" | "retur">("semua");

  // History filtering state
  const [filterDate, setFilterDate] = useState("");
  const [filterSales, setFilterSales] = useState("");

  // Computed metrics for selected date/sales filters
  const filteredRecordsForMetrics = useMemo(() => {
    return historyRecords.filter(record => {
      const matchDate = filterDate ? record.date.includes(filterDate) : true;
      const matchSales = filterSales ? record.salesName === filterSales : true;
      return matchDate && matchSales;
    });
  }, [historyRecords, filterDate, filterSales]);

  const metricsData = useMemo(() => {
    let totalRevenue = 0;
    let totalLoading = 0;
    let totalSold = 0;
    let totalReturned = 0;

    // Group by salesperson
    const salesGroup: { [name: string]: number } = {};
    // Group by date
    const dateGroup: { [date: string]: number } = {};
    // Group by product for sales volume
    const productGroup: { [productName: string]: { sold: number; retur: number; loading: number } } = {};

    filteredRecordsForMetrics.forEach(record => {
      const isLoadRecord = record.isLoadingRecord || record.tokoName === "LOADING_STOK";
      if (isLoadRecord) return;

      let recordRev = 0;
      record.items.forEach(item => {
        const sold = item.qty || 0;
        const loading = item.loading || 0;
        const retur = item.retur || 0;
        const price = item.price || 0;

        totalRevenue += sold * price;
        totalLoading += loading;
        totalSold += sold;
        totalReturned += retur;

        recordRev += sold * price;

        if (!productGroup[item.name]) {
          productGroup[item.name] = { sold: 0, retur: 0, loading: 0 };
        }
        productGroup[item.name].sold += sold;
        productGroup[item.name].retur += retur;
        productGroup[item.name].loading += loading;
      });

      // Sales Grouping
      salesGroup[record.salesName] = (salesGroup[record.salesName] || 0) + recordRev;

      // Date Grouping
      dateGroup[record.date] = (dateGroup[record.date] || 0) + recordRev;
    });

    // Format for charts
    const salesChartData = Object.keys(salesGroup).map(name => ({
      name,
      Revenue: salesGroup[name]
    })).sort((a, b) => b.Revenue - a.Revenue);

    const dateChartData = Object.keys(dateGroup).map(date => ({
      date,
      Revenue: dateGroup[date]
    })).sort((a, b) => a.date.localeCompare(b.date));

    const productChartData = Object.keys(productGroup).map(name => ({
      name,
      Sold: productGroup[name].sold,
      Retur: productGroup[name].retur,
      Loading: productGroup[name].loading
    })).sort((a, b) => b.Sold - a.Sold);

    return {
      totalRevenue,
      totalLoading,
      totalSold,
      totalReturned,
      salesChartData,
      dateChartData,
      productChartData
    };
  }, [filteredRecordsForMetrics]);

  // Dynamic products management state
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem("MASTER_PRODUCTS");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return MASTER_PRODUCTS;
  });
  const [showProductSettings, setShowProductSettings] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<"produk" | "sales">("produk");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAddProductQuery, setSearchAddProductQuery] = useState("");

  // New product form states
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdConv, setNewProdConv] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("Box");

  // Google Sheets state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsSuccess, setSheetsSuccess] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Initialize date and subscribe to Firestore for real-time synchronization
  useEffect(() => {
    // 1. Subscribe to history records
    const unsubscribeHistory = subscribeToHistory((records) => {
      setHistoryRecords(records);
      localStorage.setItem("SALES_HISTORY", JSON.stringify(records));
    });

    // 2. Subscribe to sales people list
    const defaultSales = ["Rizky", "Iman", "Deden", "Cancan", "Martin", "Fikri", "Sabani", "Lukman"];
    const unsubscribeSales = subscribeToSalesPeople((sales) => {
      setSalesPeople(sales);
      localStorage.setItem("SALES_PEOPLE", JSON.stringify(sales));
    }, defaultSales);

    // 3. Subscribe to products list
    const unsubscribeProducts = subscribeToProducts((prodList) => {
      setProducts(prodList);
      localStorage.setItem("MASTER_PRODUCTS", JSON.stringify(prodList));
    }, MASTER_PRODUCTS);

    // Initial date setup
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setTanggal(localISOTime);

    // Start with empty items list initially
    setItems([]);

    return () => {
      unsubscribeHistory();
      unsubscribeSales();
      unsubscribeProducts();
    };
  }, []);

  const getOnlyDateStr = (isoStr: string) => {
    if (!isoStr) return "";
    if (isoStr.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(isoStr)) {
      return isoStr.substring(0, 10);
    }
    try {
      const date = new Date(isoStr);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return "";
    }
  };

  const loadedSalesForDate = useMemo(() => {
    if (!tanggal) return [];
    const datePart = getOnlyDateStr(tanggal);
    const sales = historyRecords
      .filter(r => {
        const rDatePart = getOnlyDateStr(r.rawDate || r.date);
        return rDatePart === datePart && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
      })
      .map(r => r.salesName);
    return Array.from(new Set(sales));
  }, [historyRecords, tanggal]);

  // Adjust selected sales person when in penjualan mode to only be from loaded list
  useEffect(() => {
    if (activeMode === "penjualan" && loadedSalesForDate.length > 0) {
      if (!loadedSalesForDate.includes(salesName)) {
        setSalesName(loadedSalesForDate[0]);
      }
    }
  }, [activeMode, loadedSalesForDate, salesName]);

  // Automatic Loading/Syncing of form items based on sales, date, and mode
  useEffect(() => {
    if (!tanggal || !salesName) return;
    const datePart = getOnlyDateStr(tanggal);
    const currentToko = activeMode === "loading" ? "LOADING_STOK" : tokoName;
    const currentKey = `${activeMode}_${salesName}_${currentToko}_${datePart}`;

    // Prevent duplicate load or loops
    if (currentKey === lastLoadedKey) return;

    if (activeMode === "loading") {
      // Find loading record for this sales and date
      const existingLoadRecord = historyRecords.find(r => {
        const rDatePart = getOnlyDateStr(r.rawDate || r.date);
        return rDatePart === datePart && r.salesName === salesName && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
      });

      if (existingLoadRecord) {
        const restoredItems: TransactionItem[] = products.map(prod => {
          const savedItem = existingLoadRecord.items.find(it => it.name === prod.name);
          if (savedItem) {
            const conv = prod.conv || 1;
            const loadingBsr = Math.floor(savedItem.loading / conv);
            const loadingSdg = savedItem.loading % conv;
            return {
              id: prod.name,
              name: prod.name,
              price: prod.price,
              loadingBsr,
              loadingSdg,
              loading: savedItem.loading,
              qtyBsr: 0,
              qtySdg: 0,
              qty: 0,
              retur: savedItem.loading
            };
          } else {
            return {
              id: prod.name,
              name: prod.name,
              price: prod.price,
              loadingBsr: 0,
              loadingSdg: 0,
              loading: 0,
              qtyBsr: 0,
              qtySdg: 0,
              qty: 0,
              retur: 0
            };
          }
        });

        setItems(restoredItems);
        setLastLoadedKey(currentKey);
        showToast(`📝 Memuat muatan ${salesName} (${datePart}) dari database untuk diedit.`, "success");
      } else {
        // Clear items if no saved record
        setItems([]);
        setLastLoadedKey(currentKey);
      }
    } else if (activeMode === "penjualan") {
      // Find the loading record (provides initial loaded stock)
      const existingLoadRecord = historyRecords.find(r => {
        const rDatePart = getOnlyDateStr(r.rawDate || r.date);
        return rDatePart === datePart && r.salesName === salesName && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
      });

      if (!existingLoadRecord) {
        setItems([]);
        setLastLoadedKey(currentKey);
        return;
      }

      // Find if there's already a saved PENJUALAN record for this sales and store on this date
      const existingPenjualanRecord = historyRecords.find(r => {
        const rDatePart = getOnlyDateStr(r.rawDate || r.date);
        return rDatePart === datePart && r.salesName === salesName && r.tokoName === tokoName && !r.isLoadingRecord && r.tokoName !== "LOADING_STOK";
      });

      const restoredItems: TransactionItem[] = products.map(prod => {
        const loadItem = existingLoadRecord.items.find(it => it.name === prod.name);
        const savedLoading = loadItem ? loadItem.loading : 0;
        
        const soldItem = existingPenjualanRecord?.items.find(it => it.name === prod.name);
        const savedQty = soldItem ? soldItem.qty : 0;
        const savedRetur = savedLoading - savedQty;

        const conv = prod.conv || 1;
        const loadingBsr = Math.floor(savedLoading / conv);
        const loadingSdg = savedLoading % conv;
        const qtyBsr = Math.floor(savedQty / conv);
        const qtySdg = savedQty % conv;

        return {
          id: prod.name,
          name: prod.name,
          price: prod.price,
          loadingBsr,
          loadingSdg,
          loading: savedLoading,
          qtyBsr,
          qtySdg,
          qty: savedQty,
          retur: savedRetur
        };
      });

      // Filter only items with loading > 0
      const activeLoadingItems = restoredItems.filter(item => item.loading > 0);
      setItems(activeLoadingItems);
      setLastLoadedKey(currentKey);

      if (existingPenjualanRecord) {
        showToast(`📝 Memuat penjualan ${salesName} di ${tokoName} untuk diedit.`, "success");
      } else {
        showToast(`📦 Memuat muatan ${salesName} sebagai stok awal penjualan.`, "success");
      }
    }
  }, [salesName, tokoName, tanggal, activeMode, historyRecords, products, lastLoadedKey]);

  // Helper functions
  const formatRupiah = (num: number) => {
    return "Rp " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getReceiptUniqueId = (
    mode: "loading" | "penjualan",
    sales: string,
    toko: string,
    rawDate: string | number
  ) => {
    const cleanSales = (sales || "SLS").trim().toUpperCase();
    const cleanToko = (toko || "TK").trim().toUpperCase();
    const str = `${cleanSales}_${cleanToko}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hashPart = Math.abs(hash).toString(36).slice(0, 4).toUpperCase();

    let dateStr = "";
    let tsNum = Date.now();
    try {
      const d = rawDate ? new Date(rawDate) : new Date();
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dateStr = `${year}${month}${day}`;
        tsNum = d.getTime();
      } else {
        const s = String(rawDate);
        const matched = s.match(/\d+/g);
        if (matched && matched.length >= 3) {
          dateStr = matched.slice(0, 3).join("");
        } else {
          dateStr = "20260630";
        }
      }
    } catch {
      dateStr = "20260630";
    }

    const prefix = mode === "loading" ? "LD" : "PJ";
    const suffix = String(tsNum % 1000).padStart(3, "0");

    return `${prefix}-${dateStr}-${hashPart}${suffix}`;
  };

  const formatSimpleDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      const date = new Date(isoStr);
      return date.toLocaleString("id-ID", {
        dateStyle: "short",
        timeStyle: "short"
      });
    } catch {
      return isoStr;
    }
  };

  const formatFullDate = (isoStr: string, fallbackStr?: string) => {
    if (!isoStr) return fallbackStr || "-";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) {
        return fallbackStr || isoStr;
      }
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const dayName = days[date.getDay()];
      const dateStr = date.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const timeStr = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });
      return `${dayName}, ${dateStr} (${timeStr})`;
    } catch {
      return fallbackStr || isoStr;
    }
  };

  // Convert total pieces back to Bsr Sdg breakdown string
  const getBreakdownString = (name: string, totalPcs: number, hidePcs: boolean = false) => {
    const prod = products.find((p) => p.name === name);
    if (!prod) return hidePcs ? `${totalPcs}` : `${totalPcs} Pcs`;
    
    const bsr = Math.floor(totalPcs / prod.conv);
    const sdg = totalPcs % prod.conv;

    const parts: string[] = [];
    if (bsr > 0) parts.push(`${bsr} ${prod.unitBsr || "Q"}`);
    if (sdg > 0 || totalPcs === 0) {
      if (hidePcs && prod.unitSdg.toLowerCase() === "pcs") {
        parts.push(`${sdg}`);
      } else {
        parts.push(`${sdg} ${prod.unitSdg}`);
      }
    }

    return parts.join(", ");
  };

  const updateNumericField = (
    id: string,
    field: "loadingBsr" | "loadingSdg" | "qtyBsr" | "qtySdg" | "qty" | "price",
    value: number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          let updatedLoadingBsr = item.loadingBsr;
          let updatedLoadingSdg = item.loadingSdg;
          let updatedQtyBsr = item.qtyBsr ?? 0;
          let updatedQtySdg = item.qtySdg ?? 0;
          let updatedQty = item.qty;
          let updatedPrice = item.price;

          if (field === "price") {
            updatedPrice = value < 0 ? 0 : value;
          } else if (field === "loadingBsr") {
            updatedLoadingBsr = value < 0 ? 0 : value;
          } else if (field === "loadingSdg") {
            updatedLoadingSdg = value < 0 ? 0 : value;
          } else if (field === "qtyBsr") {
            updatedQtyBsr = value < 0 ? 0 : value;
          } else if (field === "qtySdg") {
            updatedQtySdg = value < 0 ? 0 : value;
          } else if (field === "qty") {
            updatedQty = value < 0 ? 0 : value;
          }

          const prod = products.find((p) => p.name === item.name);
          const conv = prod?.conv ?? 1;

          // Calculate total pieces loading
          const updatedLoading = (updatedLoadingBsr * conv) + updatedLoadingSdg;

          // Calculate total pieces sold
          if (field === "qtyBsr" || field === "qtySdg") {
            updatedQty = (updatedQtyBsr * conv) + updatedQtySdg;
          }

          // Validation
          if (updatedQty > updatedLoading) {
            showToast(`⚠️ Jumlah Terjual tidak boleh melebihi Loading Stok (${getBreakdownString(item.name, updatedLoading)})!`, "warning");
            updatedQty = updatedLoading;
          }

          // Synchronize qty components if needed
          if (field === "qty" || updatedQty > updatedLoading || (field !== "qtyBsr" && field !== "qtySdg")) {
            updatedQtyBsr = Math.floor(updatedQty / conv);
            updatedQtySdg = updatedQty % conv;
          }

          return {
            ...item,
            loadingBsr: updatedLoadingBsr,
            loadingSdg: updatedLoadingSdg,
            loading: updatedLoading,
            qtyBsr: updatedQtyBsr,
            qtySdg: updatedQtySdg,
            qty: updatedQty,
            price: updatedPrice,
            retur: updatedLoading - updatedQty
          };
        }
        return item;
      })
    );
  };

  // Calculations
  const totals = items.reduce(
    (acc, item) => {
      const prod = products.find((p) => p.name === item.name);
      const conv = prod?.conv ?? 1;

      acc.loading += item.loading;
      acc.qty += item.qty;
      acc.retur += item.retur;
      acc.grandTotal += item.qty * item.price;
      
      // Additional computations for loading mode
      acc.loadingQ += item.loadingBsr || 0;
      acc.loadingTotalQ += item.loading / conv;
      acc.loadingGrandTotal += item.loading * item.price;
      return acc;
    },
    { loading: 0, qty: 0, retur: 0, grandTotal: 0, loadingQ: 0, loadingTotalQ: 0, loadingGrandTotal: 0 }
  );

  const availableProductsToAdd = products.filter(
    (prod) => !items.some((item) => item.name === prod.name)
  );

  const filteredAvailableProducts = availableProductsToAdd.filter((prod) =>
    prod.name.toLowerCase().includes(searchAddProductQuery.toLowerCase())
  );

  // Reset form - start with empty items list
  const resetForm = () => {
    setItems([]);
    const datePart = getOnlyDateStr(tanggal);
    const currentToko = activeMode === "loading" ? "LOADING_STOK" : tokoName;
    setLastLoadedKey(`${activeMode}_${salesName}_${currentToko}_${datePart}`);
    setShowResetConfirm(false);
  };

  // Helper to synchronize products list with localStorage and active transaction items
  const syncItemsWithProducts = (newProductsList: Product[]) => {
    updateProductsInFirestore(newProductsList).catch(err => {
      console.error("Gagal sinkronisasi produk ke Firestore:", err);
    });
    
    setItems((prevItems) => {
      return prevItems
        .filter((item) => newProductsList.some((prod) => prod.name === item.name))
        .map((item) => {
          const prod = newProductsList.find((p) => p.name === item.name)!;
          return {
            ...item,
            price: prod.price
          };
        });
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice || !newProdConv) {
      alert("⚠️ Silakan isi Nama, Harga, dan Konv produk baru!");
      return;
    }
    
    const priceVal = parseInt(newProdPrice) || 0;
    const convVal = parseInt(newProdConv) || 1;
    
    if (products.some(p => p.name.toUpperCase() === newProdName.trim().toUpperCase())) {
      alert("⚠️ Nama produk sudah ada!");
      return;
    }
    
    const newProduct: Product = {
      name: newProdName.trim(),
      price: priceVal,
      conv: convVal,
      unitBsr: "Q",
      unitSdg: newProdUnit.trim() || "Pcs"
    };

    const updated = [...products, newProduct];
    syncItemsWithProducts(updated);
    
    setNewProdName("");
    setNewProdPrice("");
    setNewProdConv("");
    setNewProdUnit("Pcs");
  };

  const handleDeleteProduct = (name: string) => {
    if (window.confirm(`⚠️ Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      const updated = products.filter(p => p.name !== name);
      syncItemsWithProducts(updated);
    }
  };

  const handleUpdateProductPrice = (name: string, newPrice: number) => {
    const updated = products.map(p => p.name === name ? { ...p, price: newPrice } : p);
    syncItemsWithProducts(updated);
  };
  
  const handleUpdateProductConv = (name: string, newConv: number) => {
    const updated = products.map(p => p.name === name ? { ...p, conv: newConv } : p);
    syncItemsWithProducts(updated);
  };

  const handleUpdateProductUnit = (name: string, newUnit: string) => {
    const updated = products.map(p => p.name === name ? { ...p, unitSdg: newUnit } : p);
    syncItemsWithProducts(updated);
  };

  // Generic WhatsApp format compiler for a specific HistoryRecord
  const sendRecordToWhatsApp = (record: HistoryRecord) => {
    const tglStr = formatSimpleDate(record.rawDate || record.date);
    let message = "";

    const isLoad = record.isLoadingRecord || record.tokoName === "LOADING_STOK";
    if (isLoad) {
      message = `*REKAP LOADING - ${record.tokoName === "LOADING_STOK" ? "TK PPJ" : record.tokoName}*\n`;
      message += `----------------------------------------\n`;
      message += `🆔 *Kode Nota:* ${getReceiptUniqueId("loading", record.salesName, record.tokoName, record.rawDate || record.date)}\n`;
      message += `👤 *Sales:* ${record.salesName}\n`;
      message += `📅 *Tanggal:* ${getOnlyDateStr(record.rawDate || record.date)}\n`;
      message += `----------------------------------------\n\n`;

      let activeItemCount = 0;
      record.items.forEach((item) => {
        if (item.loading > 0) {
          activeItemCount++;
          const subtotal = (item.loading || 0) * (item.price || 0);
          message += `📦 *${item.name}*\n`;
          message += `   💵 Harga: ${formatRupiah(item.price || 0)}\n`;
          message += `   🚚 Load: *${getBreakdownString(item.name, item.loading)}* (${item.loading} Pcs)\n`;
          message += `   💸 Sub: *${formatRupiah(subtotal)}*\n`;
          message += ` --------------------\n`;
        }
      });

      if (activeItemCount === 0) {
        message += `(Belum ada muatan barang)\n`;
      }

      const totalLoading = record.items.reduce((sum, it) => sum + (it.loading || 0), 0);
      const totalRupiah = record.items.reduce((sum, it) => sum + ((it.loading || 0) * (it.price || 0)), 0);
      message += `\n▪️ *TOTAL MUATAN: ${totalLoading} Pcs*\n`;
      message += `▪️ *TOTAL NILAI: ${formatRupiah(totalRupiah)}*\n\n`;
      message += `_Laporan rekap loading via POS Web V7.5._`;
    } else {
      message = `*REKAP PENJUALAN V7.5 - ${record.tokoName}*\n`;
      message += `----------------------------------------\n`;
      message += `🆔 *Kode Nota:* ${getReceiptUniqueId("penjualan", record.salesName, record.tokoName, record.rawDate || record.date)}\n`;
      message += `👤 *Sales:* ${record.salesName}\n`;
      message += `📅 *Tanggal:* ${getOnlyDateStr(record.rawDate || record.date)}\n`;
      message += `----------------------------------------\n\n`;

      let activeItemCount = 0;
      let returDetails = "";

      record.items.forEach((item) => {
        if (item.qty > 0 || item.loading > 0 || item.retur > 0) {
          activeItemCount++;
          const subtotal = (item.qty || 0) * (item.price || 0);
          message += `🛍️ *${item.name}*\n`;
          message += `   🔹 Jual: *${getBreakdownString(item.name, item.qty)}* (${item.qty} Pcs)\n`;
          message += `   💸 Sub: *${formatRupiah(subtotal)}*\n`;
          message += ` --------------------\n`;

          if (item.retur > 0) {
            returDetails += `   - ${item.name}: *${getBreakdownString(item.name, item.retur)}* (${item.retur} Pcs)\n`;
          }
        }
      });

      if (activeItemCount === 0) {
        message += `(Belum ada transaksi barang)\n`;
      }

      if (returDetails) {
        message += `\n*🔍 RINCIAN BARANG RETUR:*\n` + returDetails;
      } else {
        message += `\n*🔍 RINCIAN BARANG RETUR:*\n   (Nihil / Semua Barang Habis Terjual)\n`;
      }

      const grandTotal = record.items.reduce((sum, it) => sum + ((it.qty || 0) * (it.price || 0)), 0);
      message += `\n▪️ *GRAND TOTAL PENJUALAN: ${formatRupiah(grandTotal)}*\n\n`;
      message += `_Laporan rekap dinamis via Aplikasi POS Web V7.5._`;
    }

    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(url, "_blank");
  };

  // html-to-image wrapper to handle generic record receipt as high-fidelity image modal
  const generateReceiptImageForRecord = async (record: HistoryRecord) => {
    const elementId = `receipt-capture-${record.id}`;
    const element = document.getElementById(elementId);
    if (!element) {
      alert("⚠️ Gagal menemukan elemen struk.");
      return;
    }
    
    setDownloading(true);
    try {
      const imgUrl = await toPng(element, {
        pixelRatio: 3, // High-resolution scale for crisp text on mobile
        backgroundColor: "#ffffff",
        style: {
          width: "300px",
          padding: "16px",
          border: "none",
        }
      });
      setGeneratedImageUrl(imgUrl);

      // Convert dataURL to a blob
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const file = new File([blob], `nota_${record.salesName}_${getOnlyDateStr(record.rawDate || record.date)}.png`, { type: "image/png" });

      const isLoad = record.isLoadingRecord || record.tokoName === "LOADING_STOK";
      const descText = isLoad
        ? `Berikut nota loading dari sales ${record.salesName}`
        : `Berikut nota penjualan dari sales ${record.salesName} di toko ${record.tokoName}`;

      // 1. Try Native Web Share API first
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Nota - ${record.salesName}`,
            text: descText
          });
          setDownloading(false);
          return;
        } catch (shareErr) {
          console.log("Web share canceled or failed:", shareErr);
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            setDownloading(false);
            return;
          }
        }
      }

      // 2. Fallback: Copy image blob directly to clipboard and launch WhatsApp
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        
        showToast("📋 Gambar nota disalin! Membuka WhatsApp...");
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(descText)}`, "_blank");
      } catch (clipErr) {
        console.warn("Clipboard copy info, showing manual save modal:", clipErr);
        setShowImageModal(true);
      }
    } catch (err) {
      console.warn("Gagal membuat gambar nota:", err);
      showToast("⚠️ Gagal merubah nota menjadi gambar. Silakan coba kembali.", "error");
    } finally {
      setDownloading(false);
    }
  };

  // WhatsApp format compiler (Clean ringkas - Tanpa total pcs summary)
  const sendToWhatsApp = () => {
    const tglStr = formatSimpleDate(tanggal);
    let message = "";

    if (activeMode === "loading") {
      message = `*REKAP LOADING - ${tokoName || "TK PPJ"}*\n`;
      message += `----------------------------------------\n`;
      message += `🆔 *Kode Nota:* ${getReceiptUniqueId("loading", salesName, "LOADING_STOK", tanggal)}\n`;
      message += `👤 *Sales:* ${salesName}\n`;
      message += `📅 *Tanggal:* ${tglStr}\n`;
      message += `----------------------------------------\n\n`;

      let activeItemCount = 0;
      items.forEach((item) => {
        if (item.loading > 0) {
          activeItemCount++;
          const subtotal = (item.loading || 0) * (item.price || 0);
          message += `📦 *${item.name}*\n`;
          message += `   💵 Harga: ${formatRupiah(item.price || 0)}\n`;
          message += `   🚚 Load: *${getBreakdownString(item.name, item.loading)}* (${item.loading} Pcs)\n`;
          message += `   💸 Sub: *${formatRupiah(subtotal)}*\n`;
          message += ` --------------------\n`;
        }
      });

      if (activeItemCount === 0) {
        message += `(Belum ada muatan barang)\n`;
      }

      const totalLoading = totals.loading;
      const totalRupiah = items.reduce((sum, it) => sum + ((it.loading || 0) * (it.price || 0)), 0);
      message += `\n▪️ *TOTAL MUATAN: ${totalLoading} Pcs*\n`;
      message += `▪️ *TOTAL NILAI: ${formatRupiah(totalRupiah)}*\n\n`;
      message += `_Laporan rekap loading via POS Web V7.5._`;
    } else {
      message = `*REKAP PENJUALAN V7.5 - ${tokoName}*\n`;
      message += `----------------------------------------\n`;
      message += `🆔 *Kode Nota:* ${getReceiptUniqueId("penjualan", salesName, tokoName || "TK_PPJ", tanggal)}\n`;
      message += `👤 *Sales:* ${salesName}\n`;
      message += `📅 *Tanggal:* ${tglStr}\n`;
      message += `----------------------------------------\n\n`;

      let activeItemCount = 0;
      let returDetails = "";

      items.forEach((item) => {
        if (item.qty > 0 || item.loading > 0 || item.retur > 0) {
          activeItemCount++;
          const subtotal = item.qty * item.price;
          message += `🛍️ *${item.name}*\n`;
          message += `   Harga: ${formatRupiah(item.price)}\n`;
          message += `   🚚 Load: *${getBreakdownString(item.name, item.loading)}* (${item.loading} Pcs)\n`;
          message += `   💰 Jual: *${item.qty} Pcs*\n`;
          message += `   🔄 Sisa (Retur): *${getBreakdownString(item.name, item.retur)}* (${item.retur} Pcs)\n`;
          message += `   *Subtotal: ${formatRupiah(subtotal)}*\n`;
          message += ` --------------------\n`;

          if (item.retur > 0) {
            returDetails += `   ⚠️ ${item.name} = *${getBreakdownString(item.name, item.retur)}* (${item.retur} Pcs)\n`;
          }
        }
      });

      if (activeItemCount === 0) {
        message += `(Belum ada transaksi barang)\n`;
      }

      // Append return details
      if (returDetails !== "") {
        message += `\n*🔍 RINCIAN BARANG RETUR:*\n` + returDetails;
      } else {
        message += `\n*🔍 RINCIAN BARANG RETUR:*\n   (Nihil / Semua Barang Habis Terjual)\n`;
      }

      message += `\n▪️ *GRAND TOTAL PENJUALAN: ${formatRupiah(totals.grandTotal)}*\n\n`;
      message += `_Laporan rekap dinamis via Aplikasi POS Web V7.5._`;
    }

    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(url, "_blank");
  };

  // html-to-image wrapper to handle receipt as high-fidelity image modal
  const generateReceiptImage = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    
    try {
      // Force receipt paper styling before capture to guarantee black on white print look
      const element = receiptRef.current;
      
      const imgUrl = await toPng(element, {
        pixelRatio: 3, // High resolution scale for crisp text on mobile screens
        backgroundColor: "#ffffff",
        style: {
          width: "300px",
          padding: "16px",
          border: "none",
        }
      });
      setGeneratedImageUrl(imgUrl);

      // Convert dataURL to a blob
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const file = new File([blob], `nota_ppj_${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });

      const descText = activeMode === "loading"
        ? `Berikut nota loading dari sales ${salesName || "Iman"}`
        : `Berikut nota penjualan dari sales ${salesName || "Iman"}`;

      // 1. Try Native Web Share API first (Excellent on Mobile/Tablets)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Nota - ${tokoName || "PPJ"}`,
            text: descText
          });
          setDownloading(false);
          return;
        } catch (shareErr) {
          console.log("Web share canceled or failed:", shareErr);
          // If the user cancelled the share operation, stop here.
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            setDownloading(false);
            return;
          }
        }
      }

      // 2. Fallback: Copy image blob directly to clipboard and launch WhatsApp
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        
        // Show success alert and instantly open WhatsApp with description text
        showToast("📋 Gambar nota disalin! Membuka WhatsApp...");
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(descText)}`, "_blank");
      } catch (clipErr) {
        console.warn("Clipboard copy failed, showing manual save modal:", clipErr);
        // 3. Ultimate Fallback: Open manual download & copy modal for old browsers
        setShowImageModal(true);
      }
    } catch (err) {
      console.warn("Gagal membuat gambar nota:", err);
      showToast("⚠️ Gagal merubah nota menjadi gambar. Silakan coba kembali.", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Copy PNG image to device clipboard
  const copyImageToClipboard = async () => {
    if (!generatedImageUrl) return;
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      showToast("✅ Gambar berhasil disalin ke clipboard!");
    } catch (err) {
      console.warn("Info menyalin gambar:", err);
      showToast("⚠️ Browser Anda tidak mendukung salin gambar langsung. Silakan tekan lama gambar untuk menyimpan manual.", "warning");
    }
  };

  // Copy PNG image to device clipboard and open WhatsApp
  const copyAndOpenWhatsApp = async () => {
    if (!generatedImageUrl) return;
    const descText = activeMode === "loading"
      ? `Berikut nota loading dari sales ${salesName || "Iman"}`
      : `Berikut nota penjualan dari sales ${salesName || "Iman"}`;
    const encodedText = encodeURIComponent(descText);

    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `nota_ppj_${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });

      // 1. Try Native Web Share API first (Excellent on Mobile/Tablets)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Nota - ${salesName || "PPJ"}`,
            text: descText
          });
          return;
        } catch (shareErr) {
          console.log("Web share canceled or failed:", shareErr);
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            return;
          }
        }
      }

      // 2. Fallback: Copy image blob directly to clipboard and launch WhatsApp
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        
        showToast("📋 Gambar nota disalin! Membuka WhatsApp...");
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
      } catch (clipErr) {
        console.warn("Clipboard copy failed, showing manual save warning:", clipErr);
        showToast("⚠️ Lampirkan gambar secara manual via WhatsApp.");
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
      }
    } catch (err) {
      console.warn("Gagal menyalin gambar:", err);
      showToast("⚠️ Silakan tekan lama gambar untuk menyimpan manual, lalu kirim via WhatsApp.", "warning");
      // Fallback: still open WhatsApp
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
    }
  };

  // Download image helper (Traditional fallback)
  const downloadImageFile = () => {
    if (!generatedImageUrl) return;
    const downloadLink = document.createElement("a");
    downloadLink.href = generatedImageUrl;
    const slugifiedToko = tokoName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    downloadLink.download = `nota_ppj_${slugifiedToko}_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setSheetsError(null);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("cancelled-popup-request") || 
        errMsg.includes("popup-closed-by-user") || 
        errMsg.includes("popup-blocked") ||
        errMsg.includes("Pending promise was never set")
      ) {
        console.warn("Gagal Login Google (Expected in iframe/popup blocked):", err);
        setSheetsError("⚠️ Login Google diblokir atau dibatalkan oleh browser/iframe. Silakan klik tombol 'Buka di Tab Baru' (Open in New Tab) di pojok kanan atas layar AI Studio Anda agar Google Sign-In berjalan lancar.");
      } else {
        console.error("Gagal Login Google:", err);
        setSheetsError(`Gagal Login Google: ${errMsg}. Jika Anda menggunakan pratinjau AI Studio, silakan coba membukanya di Tab Baru.`);
      }
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
    } catch (err: any) {
      console.error("Gagal Logout Google:", err);
    }
  };

  const saveToLocalHistory = async () => {
    if (!salesName) {
      alert("⚠️ Silakan pilih Nama Sales terlebih dahulu.");
      return;
    }
    const isLoadMode = activeMode === "loading";
    const currentToko = isLoadMode ? "LOADING_STOK" : tokoName;

    if (!isLoadMode && !currentToko) {
      alert("⚠️ Silakan masukkan Nama Toko terlebih dahulu.");
      return;
    }
    if (!tanggal) {
      alert("⚠️ Silakan pilih Tanggal terlebih dahulu.");
      return;
    }

    // Filter items with actual quantities
    const activeItems = items.filter(
      (item) => isLoadMode ? (item.loading > 0) : (item.loading > 0 || item.qty > 0 || item.retur > 0)
    );

    if (activeItems.length === 0) {
      alert(isLoadMode 
        ? "⚠️ Belum ada input muatan (loading). Silakan masukkan data barang terlebih dahulu."
        : "⚠️ Belum ada penjualan atau muatan. Silakan masukkan data barang terlebih dahulu."
      );
      return;
    }

    if (!isLoadMode) {
      // Enforce loaded stock cannot be 0 (stok yg dimuat tidak bisa 0)
      const zeroLoadingItems = activeItems.filter(item => item.loading <= 0);
      if (zeroLoadingItems.length > 0) {
        alert(`⚠️ Stok yang dimuat tidak boleh 0! Harap isi jumlah muatan (loading) atau hapus barang berikut dari daftar:\n\n` + 
          zeroLoadingItems.map(item => `- ${item.name}`).join("\n")
        );
        return;
      }
    }

    const tglStr = formatSimpleDate(tanggal);
    const datePart = getOnlyDateStr(tanggal);

    // Check if there's already a record for same date, salesName, and tokoName
    const existsIndex = historyRecords.findIndex(r => {
      const rDatePart = getOnlyDateStr(r.rawDate || r.date);
      return rDatePart === datePart && r.salesName === salesName && r.tokoName === currentToko && (isLoadMode ? (r.isLoadingRecord || r.tokoName === "LOADING_STOK") : (!r.isLoadingRecord && r.tokoName !== "LOADING_STOK"));
    });

    let recordId = `${datePart}_${salesName}_${currentToko}_${Date.now()}`;
    if (existsIndex >= 0) {
      recordId = historyRecords[existsIndex].id;
    }

    const newRecord: HistoryRecord = {
      id: recordId,
      date: tglStr,
      rawDate: tanggal,
      salesName,
      tokoName: currentToko,
      isLoadingRecord: isLoadMode,
      items: activeItems.map(item => ({
        name: item.name,
        price: item.price || 0,
        loading: item.loading,
        qty: isLoadMode ? 0 : item.qty,
        retur: isLoadMode ? item.loading : item.retur
      })),
      timestamp: Date.now()
    };

    // Overwrite existing records directly without blocking prompts in iframe environment

    try {
      await saveHistoryToFirestore(newRecord);
      setHistorySuccess(true);
      setTimeout(() => setHistorySuccess(false), 3000);
      setIsEditingSavedPenjualan(false);
      
      // Update lastLoadedKey to match the newly saved record key to prevent automatic reload of old data
      setLastLoadedKey(`${activeMode}_${salesName}_${currentToko}_${datePart}`);

      showToast(isLoadMode ? "✅ Muatan berhasil disimpan ke Database!" : "✅ Rekap Penjualan berhasil disimpan ke Database!");
      alert(`✅ Rekap berhasil disimpan ke Server & Histori!\n\nSales: ${salesName}\n${isLoadMode ? "Gudang (Loading Muatan)" : `Toko: ${currentToko}`}\nTanggal: ${datePart}`);
    } catch (e) {
      alert("❌ Gagal menyimpan rekap ke server. Silakan coba lagi.");
    }
  };

  const openMuatanPopupForSales = (selectedSales: string) => {
    setMuatanPopupSales(selectedSales);
    setMuatanPopupSearch(""); // reset search
    
    // Default date to global tanggal (as YYYY-MM-DD) or today's date
    let dateToUse = tanggal ? getOnlyDateStr(tanggal) : getOnlyDateStr(new Date().toISOString());
    setMuatanPopupDate(dateToUse);
    
    const existingRecord = historyRecords.find(r => {
      const rDatePart = getOnlyDateStr(r.rawDate || r.date);
      return rDatePart === dateToUse && r.salesName === selectedSales && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
    });
    
    const initialItems = [];
    products.forEach(prod => {
      const savedItem = existingRecord?.items.find(it => it.name === prod.name);
      const loadingVal = savedItem ? savedItem.loading : 0;
      if (loadingVal > 0) {
        const conv = prod.conv || 1;
        const loadingBsr = Math.floor(loadingVal / conv);
        const loadingSdg = loadingVal % conv;
        initialItems.push({
          name: prod.name,
          price: prod.price,
          loadingBsr,
          loadingSdg,
          loading: loadingVal
        });
      }
    });
    
    setMuatanPopupItems(initialItems);
    setShowMuatanPopup(true);
  };

  const handleMuatanPopupDateChange = (newDate: string) => {
    setMuatanPopupDate(newDate);
    const existingRecord = historyRecords.find(r => {
      const rDatePart = getOnlyDateStr(r.rawDate || r.date);
      return rDatePart === newDate && r.salesName === muatanPopupSales && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
    });
    
    const loadedItems = [];
    products.forEach(prod => {
      const savedItem = existingRecord?.items.find(it => it.name === prod.name);
      const loadingVal = savedItem ? savedItem.loading : 0;
      if (loadingVal > 0) {
        const conv = prod.conv || 1;
        const loadingBsr = Math.floor(loadingVal / conv);
        const loadingSdg = loadingVal % conv;
        loadedItems.push({
          name: prod.name,
          price: prod.price,
          loadingBsr,
          loadingSdg,
          loading: loadingVal
        });
      }
    });
    setMuatanPopupItems(loadedItems);
  };

  const addProductToMuatanPopup = (productName: string) => {
    const prod = products.find(p => p.name === productName);
    if (!prod) return;
    
    if (muatanPopupItems.some(it => it.name === productName)) {
      showToast(`⚠️ ${productName} sudah ada dalam daftar.`);
      return;
    }
    
    setMuatanPopupItems(prev => [
      ...prev,
      {
        name: prod.name,
        price: prod.price,
        loadingBsr: 0,
        loadingSdg: 0,
        loading: 0
      }
    ]);
    showToast(`✅ Berhasil menambahkan ${prod.name}`);
  };

  const removeProductFromMuatanPopup = (productName: string) => {
    setMuatanPopupItems(prev => prev.filter(item => item.name !== productName));
  };

  const deleteMuatanRecord = async (salesNameToDelete: string) => {
    const datePart = tanggal ? getOnlyDateStr(tanggal) : getOnlyDateStr(new Date().toISOString());
    const recordToDelete = historyRecords.find(r => {
      const rDatePart = getOnlyDateStr(r.rawDate || r.date);
      return rDatePart === datePart && r.salesName === salesNameToDelete && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
    });
    
    if (!recordToDelete) {
      showToast("⚠️ Data muatan tidak ditemukan.", "error");
      return;
    }
    
    try {
      await deleteHistoryFromFirestore(recordToDelete.id);
      showToast(`🗑️ Berhasil menghapus muatan untuk ${salesNameToDelete}`);
    } catch (e) {
      console.error(e);
      showToast("❌ Gagal menghapus muatan dari database. Silakan coba lagi.", "error");
    }
  };

  const updateMuatanPopupItemField = (
    productName: string,
    field: "loadingBsr" | "loadingSdg",
    val: number
  ) => {
    const value = val < 0 ? 0 : val;
    setMuatanPopupItems(prev => prev.map(item => {
      if (item.name === productName) {
        const prod = products.find(p => p.name === productName);
        const conv = prod?.conv || 1;
        
        const updatedBsr = field === "loadingBsr" ? value : item.loadingBsr;
        const updatedSdg = field === "loadingSdg" ? value : item.loadingSdg;
        const totalLoading = (updatedBsr * conv) + updatedSdg;
        
        return {
          ...item,
          loadingBsr: updatedBsr,
          loadingSdg: updatedSdg,
          loading: totalLoading
        };
      }
      return item;
    }));
  };

  const saveMuatanFromPopup = async () => {
    if (!muatanPopupSales) {
      alert("⚠️ Nama Sales tidak valid.");
      return;
    }
    if (!muatanPopupDate) {
      alert("⚠️ Silakan pilih tanggal muatan.");
      return;
    }
    
    const activeItems = muatanPopupItems.filter(item => item.loading > 0);
    if (activeItems.length === 0) {
      alert("⚠️ Harap isi minimal satu muatan barang!");
      return;
    }
    
    const tglStr = formatSimpleDate(muatanPopupDate);
    const datePart = getOnlyDateStr(muatanPopupDate);
    const currentToko = "LOADING_STOK";
    
    const existsIndex = historyRecords.findIndex(r => {
      const rDatePart = getOnlyDateStr(r.rawDate || r.date);
      return rDatePart === datePart && r.salesName === muatanPopupSales && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
    });
    
    let recordId = `${datePart}_${muatanPopupSales}_${currentToko}_${Date.now()}`;
    if (existsIndex >= 0) {
      recordId = historyRecords[existsIndex].id;
    }
    
    const newRecord: HistoryRecord = {
      id: recordId,
      date: tglStr,
      rawDate: muatanPopupDate,
      salesName: muatanPopupSales,
      tokoName: currentToko,
      isLoadingRecord: true,
      items: activeItems.map(item => ({
        name: item.name,
        price: item.price || 0,
        loading: item.loading,
        qty: 0,
        retur: item.loading
      })),
      timestamp: Date.now()
    };
    
    setIsSavingMuatan(true);
    try {
      await saveHistoryToFirestore(newRecord);
      
      // Update local state if the main form's currently loaded sales/date matches
      if (salesName === muatanPopupSales && activeMode === "loading") {
        setItems(products.map(prod => {
          const savedItem = activeItems.find(it => it.name === prod.name);
          if (savedItem) {
            const conv = prod.conv || 1;
            return {
              id: prod.name,
              name: prod.name,
              price: prod.price,
              loadingBsr: savedItem.loadingBsr,
              loadingSdg: savedItem.loadingSdg,
              loading: savedItem.loading,
              qtyBsr: 0,
              qtySdg: 0,
              qty: 0,
              retur: savedItem.loading
            };
          } else {
            return {
              id: prod.name,
              name: prod.name,
              price: prod.price,
              loadingBsr: 0,
              loadingSdg: 0,
              loading: 0,
              qtyBsr: 0,
              qtySdg: 0,
              qty: 0,
              retur: 0
            };
          }
        }));
        setLastLoadedKey(`loading_${muatanPopupSales}_${currentToko}_${datePart}`);
      } else if (salesName === muatanPopupSales && activeMode === "penjualan") {
        setLastLoadedKey(""); // Reset to force trigger
      }
      
      showToast(`✅ Muatan ${muatanPopupSales} pada tanggal ${datePart} berhasil disimpan!`);
      setShowMuatanPopup(false);
    } catch (e) {
      console.error(e);
      showToast("❌ Gagal menyimpan muatan ke database. Silakan coba lagi.", "error");
    } finally {
      setIsSavingMuatan(false);
    }
  };

  const addSalesPerson = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (salesPeople.includes(trimmed)) {
      alert("⚠️ Nama sales sudah ada di dalam daftar!");
      return;
    }
    const newList = [...salesPeople, trimmed];
    try {
      await updateSalesPeopleInFirestore(newList);
      setNewSalesName("");
      alert(`✅ Berhasil menambah sales ke server: ${trimmed}`);
    } catch (e) {
      alert("❌ Gagal menambahkan sales ke server.");
    }
  };

  const deleteSalesPerson = async (index: number) => {
    const nameToDelete = salesPeople[index];
    if (window.confirm(`⚠️ Apakah Anda yakin ingin menghapus sales "${nameToDelete}" dari daftar?`)) {
      const newList = salesPeople.filter((_, i) => i !== index);
      try {
        await updateSalesPeopleInFirestore(newList);
        // If active sales is deleted, reset to first salesperson in list
        if (salesName === nameToDelete) {
          setSalesName(newList[0] || "");
        }
      } catch (e) {
        alert("❌ Gagal menghapus sales dari server.");
      }
    }
  };

  const startEditSalesPerson = (index: number) => {
    setEditingSalesIndex(index);
    setEditingSalesName(salesPeople[index]);
  };

  const saveEditSalesPerson = async () => {
    if (editingSalesIndex === null) return;
    const oldName = salesPeople[editingSalesIndex];
    const newName = editingSalesName.trim();
    if (!newName) return;
    if (newName === oldName) {
      setEditingSalesIndex(null);
      return;
    }
    if (salesPeople.includes(newName) && salesPeople.indexOf(newName) !== editingSalesIndex) {
      alert("⚠️ Nama sales ini sudah terdaftar!");
      return;
    }

    const newList = [...salesPeople];
    newList[editingSalesIndex] = newName;

    // Also update history records matching old name to maintain data integrity!
    const updatedHistory = historyRecords.map(record => {
      if (record.salesName === oldName) {
        return { ...record, salesName: newName };
      }
      return record;
    });

    try {
      await updateSalesPeopleInFirestore(newList);
      
      // Update any matching history records in Firestore
      for (const record of updatedHistory) {
        if (record.salesName === newName && historyRecords.find(r => r.id === record.id)?.salesName === oldName) {
          await saveHistoryToFirestore(record);
        }
      }

      if (salesName === oldName) {
        setSalesName(newName);
      }
      setEditingSalesIndex(null);
      alert(`✅ Berhasil merubah nama dari "${oldName}" menjadi "${newName}"`);
    } catch (e) {
      alert("❌ Gagal menyimpan perubahan sales ke server.");
    }
  };

  const deleteHistoryRecord = async (recordId: string) => {
    try {
      await deleteHistoryFromFirestore(recordId);
      showToast("🗑️ Rekap berhasil dihapus!", "success");
    } catch (e) {
      showToast("❌ Gagal menghapus rekap dari server.", "error");
    }
  };

  const restoreHistoryRecord = (record: HistoryRecord) => {
    const isLoad = record.isLoadingRecord || record.tokoName === "LOADING_STOK";
    setSalesName(record.salesName);
    
    if (isLoad) {
      setTokoName("LOADING_STOK");
      setActiveMode("loading");
    } else {
      setTokoName(record.tokoName);
      setActiveMode("penjualan");
    }
    
    if (record.rawDate) {
      setTanggal(record.rawDate);
    }
      
      const restoredItems: TransactionItem[] = products.map(prod => {
        const savedItem = record.items.find(it => it.name === prod.name);
        if (savedItem) {
          const conv = prod.conv || 1;
          const loadingBsr = Math.floor(savedItem.loading / conv);
          const loadingSdg = savedItem.loading % conv;
          const qtyBsr = Math.floor(savedItem.qty / conv);
          const qtySdg = savedItem.qty % conv;

          return {
            id: prod.name,
            name: prod.name,
            price: prod.price,
            loadingBsr,
            loadingSdg,
            loading: savedItem.loading,
            qtyBsr,
            qtySdg,
            qty: savedItem.qty,
            retur: savedItem.retur
          };
        } else {
          return {
            id: prod.name,
            name: prod.name,
            price: prod.price,
            loadingBsr: 0,
            loadingSdg: 0,
            loading: 0,
            qtyBsr: 0,
            qtySdg: 0,
            qty: 0,
            retur: 0
          };
        }
      });

      const finalItems = isLoad ? restoredItems : restoredItems.filter(item => item.loading > 0);
      setItems(finalItems);
      
      // Compute and set lastLoadedKey to prevent automatic reloading in useEffect
      const datePart = getOnlyDateStr(record.rawDate || record.date);
      const currentToko = isLoad ? "LOADING_STOK" : record.tokoName;
      setLastLoadedKey(`${isLoad ? "loading" : "penjualan"}_${record.salesName}_${currentToko}_${datePart}`);

      setActiveTab("transaksi");
      showToast(`✅ Berhasil memuat rekap ${record.date} ke form input!`);
  };

  const saveToGoogleSheets = async () => {
    if (!token) {
      await handleGoogleSignIn();
      return;
    }

    setSheetsSyncing(true);
    setSheetsSuccess(false);
    setSheetsError(null);

    try {
      const sId = await findOrCreateSpreadsheet(token, "Rekap Penjualan TK PPJ");
      setSpreadsheetId(sId);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${sId}/edit`);

      const meta = {
        salesName,
        tokoName,
        tanggal: formatSimpleDate(tanggal)
      };

      await appendTransactionToSheet(token, sId, meta, items);
      
      setSheetsSuccess(true);
      setTimeout(() => setSheetsSuccess(false), 4000);
    } catch (err: any) {
      console.error("Gagal menyimpan ke Google Sheets:", err);
      setSheetsError("Gagal menyimpan data rekap ke Google Sheets. Silakan coba kembali.");
    } finally {
      setSheetsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-20">
      {/* Sticky Compact Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-indigo-700 text-white shadow-md border-b border-indigo-800 backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2.5 select-none">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl shadow-inner border border-white/15">
                <Calculator className="h-5 w-5 text-indigo-100" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm md:text-base font-extrabold tracking-wide text-white">TK PPJ</h1>
                  <span className="bg-emerald-500 text-[8px] text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">V7.6</span>
                </div>
                <p className="text-[10px] text-indigo-200 font-medium">POS & Rekap Penjualan Otomatis</p>
              </div>
            </div>
            
            {/* Quick settings button on mobile */}
            <button
              onClick={() => {
                setShowProductSettings(true);
                setSettingsActiveTab("produk");
              }}
              className="sm:hidden bg-indigo-600 hover:bg-indigo-500 text-white font-black p-2 rounded-lg cursor-pointer transition-all border border-indigo-500 shadow-sm"
              title="Pengaturan Aplikasi"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          
          {/* Main Tab Selector */}
          <div className="flex bg-black/25 p-0.5 rounded-xl border border-white/10 shrink-0 w-full sm:w-auto justify-center">
            <button
              onClick={() => setActiveTab("transaksi")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "transaksi"
                  ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                  : "text-indigo-100 hover:text-white"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Transaksi</span>
            </button>
            <button
              onClick={() => setActiveTab("histori")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "histori"
                  ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                  : "text-indigo-100 hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Histori</span>
            </button>
            <button
              onClick={() => setActiveTab("metrics")}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "metrics"
                  ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                  : "text-indigo-100 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Metrics</span>
            </button>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => {
                setShowProductSettings(true);
                setSettingsActiveTab("produk");
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-1.5 px-3 rounded-lg text-[11px] md:text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-indigo-500 shadow-sm"
              title="Pengaturan Aplikasi"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pengaturan</span>
            </button>
            
            {/* Segmented Mode Switcher */}
            {activeTab === "transaksi" && (
              <div className="flex bg-black/25 p-0.5 rounded-xl border border-white/10 shrink-0">
                <button
                  onClick={() => setActiveMode("loading")}
                  className={`px-2.5 md:px-3.5 py-1.5 rounded-lg font-bold text-[11px] md:text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMode === "loading"
                      ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                      : "text-indigo-100 hover:text-white"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline-block sm:hidden">Load</span>
                  <span className="hidden sm:inline-block">Input Loading</span>
                  <span className="xs:hidden">Load</span>
                </button>
                <button
                  onClick={() => setActiveMode("penjualan")}
                  className={`px-2.5 md:px-3.5 py-1.5 rounded-lg font-bold text-[11px] md:text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMode === "penjualan"
                      ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                      : "text-indigo-100 hover:text-white"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline-block sm:hidden">Jual</span>
                  <span className="hidden sm:inline-block">Input Penjualan</span>
                  <span className="xs:hidden">Jual</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile-only Segmented Mode Switcher sub-bar */}
        {activeTab === "transaksi" && (
          <div className="sm:hidden bg-indigo-800 px-4 py-2 flex justify-between items-center border-t border-indigo-900">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Mode Input:</span>
            <div className="flex bg-black/25 p-0.5 rounded-xl border border-white/10 shrink-0">
              <button
                onClick={() => setActiveMode("loading")}
                className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer ${
                  activeMode === "loading"
                    ? "bg-white text-indigo-700 shadow-xs font-black"
                    : "text-indigo-100"
                }`}
              >
                <Truck className="w-3 h-3" />
                <span>Input Loading</span>
              </button>
              <button
                onClick={() => setActiveMode("penjualan")}
                className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer ${
                  activeMode === "penjualan"
                    ? "bg-white text-indigo-700 shadow-xs font-black"
                    : "text-indigo-100"
                }`}
              >
                <Store className="w-3 h-3" />
                <span>Input Penjualan</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        {activeTab === "transaksi" ? (
          showMuatanPopup ? (
            (() => {
              const popupTotals = muatanPopupItems.reduce(
                (acc, item) => {
                  const prod = products.find((p) => p.name === item.name);
                  const conv = prod?.conv ?? 1;
                  acc.loading += item.loading;
                  acc.loadingQ += item.loadingBsr || 0;
                  acc.loadingTotalQ += item.loading / conv;
                  acc.loadingGrandTotal += item.loading * item.price;
                  return acc;
                },
                { loading: 0, loadingQ: 0, loadingTotalQ: 0, loadingGrandTotal: 0 }
              );

              return (
                <div className="space-y-6 animate-fade-in">
                  {/* Page Breadcrumb / Navigation Header */}
                  <div className="bg-indigo-700 text-white rounded-2xl p-6 shadow-md border border-indigo-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/10 rounded-xl border border-white/15">
                        <Truck className="w-6 h-6 text-indigo-100" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setShowMuatanPopup(false)}
                            className="text-xs font-bold text-indigo-200 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Daftar Sales
                          </button>
                          <span className="text-indigo-300">/</span>
                          <span className="text-xs font-bold text-white">Input Muatan</span>
                        </div>
                        <h2 className="font-extrabold text-lg sm:text-xl mt-1">Input Muatan: {muatanPopupSales}</h2>
                        <p className="text-xs text-indigo-200/90 font-medium mt-0.5">Kelola & Simpan Muatan Barang Gudang Langsung ke Database</p>
                      </div>
                    </div>
                    
                    {/* Back Button */}
                    <button
                      type="button"
                      onClick={() => setShowMuatanPopup(false)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Kembali ke Daftar Sales
                    </button>
                  </div>

                  {/* Main Two-Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Inputs (Span 8) */}
                    <div className="lg:col-span-8 space-y-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-3xs">
                      
                      {/* Form Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date Picker */}
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/85">
                          <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                            📅 Tanggal Muatan Stok
                          </label>
                          <input 
                            type="date" 
                            value={muatanPopupDate}
                            onChange={(e) => handleMuatanPopupDateChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-3xs"
                          />
                        </div>

                        {/* Search Input */}
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/85 flex flex-col justify-between">
                          <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                            🔍 Pencarian Barang
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Cari nama produk di muatan..."
                              value={muatanPopupSearch}
                              onChange={(e) => setMuatanPopupSearch(e.target.value)}
                              className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl pl-9 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-3xs placeholder:text-slate-400"
                            />
                            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            {muatanPopupSearch && (
                              <button
                                type="button"
                                onClick={() => setMuatanPopupSearch("")}
                                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items Grid Title and Clear Button */}
                      <div className="flex justify-between items-center pt-2">
                        <h4 className="font-extrabold text-xs text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                          📦 Daftar Muatan Barang ({muatanPopupItems.filter(item => item.name.toLowerCase().includes(muatanPopupSearch.toLowerCase())).length} Item)
                        </h4>
                        <button 
                          type="button"
                          onClick={() => {
                            if (window.confirm("Apakah Anda yakin ingin mengosongkan semua isian muatan ini?")) {
                              setMuatanPopupItems(prev => prev.map(item => ({
                                ...item,
                                loadingBsr: 0,
                                loadingSdg: 0,
                                loading: 0
                              })));
                            }
                          }}
                          className="text-[10px] font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-100 transition-all cursor-pointer"
                        >
                          Kosongkan Semua Muatan
                        </button>
                      </div>

                      {/* Items Grid List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {muatanPopupItems
                          .filter(item => item.name.toLowerCase().includes(muatanPopupSearch.toLowerCase()))
                          .map((item, index) => {
                            const prod = products.find(p => p.name === item.name);
                            const conv = prod?.conv || 1;
                            
                            return (
                              <div key={item.name} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-3xs hover:border-indigo-200 transition-colors flex flex-col justify-between gap-3">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                                      #{index + 1}
                                    </span>
                                    <h5 className="font-extrabold text-xs text-slate-800 mt-1 truncate" title={item.name}>{item.name}</h5>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] text-indigo-600 bg-indigo-50/85 px-1.5 py-0.5 rounded-md font-mono font-black border border-indigo-100/30">
                                      1{prod?.unitBsr ?? "Q"} = {conv} {prod?.unitSdg ?? "Pcs"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removeProductFromMuatanPopup(item.name);
                                        showToast(`🗑️ ${item.name} dihapus dari daftar muatan.`);
                                      }}
                                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                      title="Hapus dari daftar"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Dual inputs for Bsr & Sdg */}
                                <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">{prod?.unitBsr ?? "Q"}</span>
                                    <div className="flex items-center w-full gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateMuatanPopupItemField(item.name, "loadingBsr", Math.max(0, item.loadingBsr - 1))}
                                        className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer select-none shrink-0"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number" 
                                        min="0"
                                        value={item.loadingBsr === 0 ? "" : item.loadingBsr}
                                        placeholder="0"
                                        onChange={(e) => updateMuatanPopupItemField(item.name, "loadingBsr", parseInt(e.target.value) || 0)}
                                        className="w-full text-center bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md py-1 text-xs font-black font-mono text-indigo-950 min-w-0"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => updateMuatanPopupItemField(item.name, "loadingBsr", item.loadingBsr + 1)}
                                        className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer select-none shrink-0"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase mb-1">{prod?.unitSdg ?? "Pcs"}</span>
                                    <div className="flex items-center w-full gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateMuatanPopupItemField(item.name, "loadingSdg", Math.max(0, item.loadingSdg - 1))}
                                        className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer select-none shrink-0"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number" 
                                        min="0"
                                        value={item.loadingSdg === 0 ? "" : item.loadingSdg}
                                        placeholder="0"
                                        onChange={(e) => updateMuatanPopupItemField(item.name, "loadingSdg", parseInt(e.target.value) || 0)}
                                        className="w-full text-center bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md py-1 text-xs font-black font-mono text-indigo-950 min-w-0"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => updateMuatanPopupItemField(item.name, "loadingSdg", item.loadingSdg + 1)}
                                        className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer select-none shrink-0"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center px-1 text-[10px] text-slate-400">
                                  <span>Total Muatan:</span>
                                  <span className="font-black text-indigo-600">
                                    {item.loadingBsr > 0 ? `${item.loadingBsr} ${prod?.unitBsr ?? "Q"}` : ""}
                                    {item.loadingBsr > 0 && item.loadingSdg > 0 ? " + " : ""}
                                    {item.loadingSdg > 0 ? `${item.loadingSdg} ${prod?.unitSdg ?? "Pcs"}` : ""}
                                    {item.loading === 0 ? "0" : ""} ({item.loading} pcs)
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Simple Add Product Selector at the Bottom */}
                      {products.filter(p => !muatanPopupItems.some(it => it.name === p.name)).length > 0 ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                          <div className="min-w-0 flex-1">
                            <label className="block text-[10px] font-black uppercase text-indigo-700 tracking-wider mb-0.5">
                              ➕ Tambah Barang Ke Muatan
                            </label>
                            <p className="text-[11px] text-slate-500 font-medium">Pilih barang untuk dimasukkan ke muatan sales</p>
                          </div>
                          <select
                            id="add-page-product-select"
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full sm:w-60 shadow-3xs"
                            onChange={(e) => {
                              const selectedVal = e.target.value;
                              if (selectedVal) {
                                addProductToMuatanPopup(selectedVal);
                                e.target.value = ""; // reset selection
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Pilih barang...</option>
                            {products
                              .filter(p => !muatanPopupItems.some(it => it.name === p.name))
                              .map(p => (
                                <option key={p.name} value={p.name}>
                                  {p.name}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      ) : (
                        <div className="text-center p-3.5 bg-emerald-50 border border-emerald-100/50 rounded-xl text-xs font-bold text-emerald-700 mt-4">
                          🎉 Semua jenis produk telah ditambahkan ke muatan
                        </div>
                      )}

                    </div>

                    {/* Right Column: Actions & Live Preview Struk (Span 4) */}
                    <div className="lg:col-span-4 space-y-6">
                      
                      {/* Action Cards */}
                      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-5 space-y-3.5">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Save className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-800">Aksi Muatan Gudang</h3>
                            <p className="text-[10px] text-slate-400">Simpan rekap muatan sales ini ke database</p>
                          </div>
                        </div>

                        {/* Save Button */}
                        <button 
                          type="button"
                          onClick={saveMuatanFromPopup}
                          disabled={isSavingMuatan}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black py-3 px-4 rounded-xl shadow-md shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98]"
                        >
                          {isSavingMuatan ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Menyimpan ke Database...</span>
                            </>
                          ) : (
                            <>
                              <Database className="h-4 w-4" />
                              <span>Simpan ke Database</span>
                            </>
                          )}
                        </button>

                        <button 
                          type="button"
                          onClick={() => setShowMuatanPopup(false)}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
                        >
                          Batal / Tutup
                        </button>
                      </div>

                      {/* Live Preview Receipt */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-100/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> LIVE PREVIEW STRUK:
                          </p>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">Thermal paper layout</span>
                        </div>

                        {/* Thermal Paper Receipt */}
                        <div className="receipt-paper border border-slate-300 shadow-sm rounded-lg overflow-hidden bg-white">
                          <div 
                            className="p-4 font-mono text-[11px] leading-relaxed text-black"
                            style={{ wordBreak: "break-word", backgroundColor: "#ffffff" }}
                          >
                            <div className="text-center mb-3">
                              <h2 className="text-sm font-bold tracking-wider uppercase m-0 text-black">
                                TK PPJ
                              </h2>
                              <p className="m-0 text-[9px] font-semibold text-slate-600 mt-0.5">
                                REKAP LOADING MUATAN
                              </p>
                              <div className="my-2 border-b border-dashed border-black" />
                            </div>

                            {/* Metadata */}
                            <div className="space-y-0.5 mb-2 text-[10px] text-black">
                              <div className="flex justify-between text-black font-semibold">
                                <span>KODE NOTA:</span>
                                <span className="font-extrabold font-mono text-xs">{getReceiptUniqueId("loading", muatanPopupSales, "LOADING_STOK", muatanPopupDate)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>SALES:</span>
                                <span className="font-bold">{muatanPopupSales || "-"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>TANGGAL:</span>
                                <span>{formatSimpleDate(muatanPopupDate)}</span>
                              </div>
                            </div>

                            <div className="my-2 border-b border-dashed border-black" />

                            {/* Items table */}
                            <table className="w-full text-left text-[10px] border-collapse text-black">
                              <thead>
                                <tr className="font-bold border-b border-dashed border-black">
                                  <th className="pb-1 text-left w-5">NO</th>
                                  <th className="pb-1 text-left">BARANG</th>
                                  <th className="pb-1 text-center w-10">LOAD</th>
                                  <th className="pb-1 text-right w-16">HARGA</th>
                                  <th className="pb-1 text-right w-18">TOTAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  let serialNum = 0;
                                  const filtered = muatanPopupItems.filter(it => it.loading > 0);
                                  if (filtered.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-400 italic font-sans text-[10px]">
                                          Belum ada muatan barang
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return filtered.map((item, idx) => {
                                    serialNum++;
                                    const loadBreakdown = getBreakdownString(item.name, item.loading, false);
                                    return (
                                      <React.Fragment key={item.name}>
                                        <tr className="border-t border-dotted border-black/30 text-black">
                                          <td className="py-1 text-left font-mono">{serialNum}</td>
                                          <td className="py-1 pr-1 font-bold truncate max-w-[90px]">{item.name}</td>
                                          <td className="py-1 text-center font-mono">{item.loading}</td>
                                          <td className="py-1 text-right font-mono">{formatRupiah(item.price || 0).replace("Rp ", "")}</td>
                                          <td className="py-1 text-right font-mono">{formatRupiah(item.loading * (item.price || 0)).replace("Rp ", "")}</td>
                                        </tr>
                                        <tr>
                                          <td colSpan={5} className="text-[8px] text-slate-500 pb-1 font-sans">
                                            <span>Detail: {loadBreakdown}</span>
                                          </td>
                                        </tr>
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>

                            <div className="my-2 border-b border-dashed border-black" />

                            {/* Totals */}
                            <div className="space-y-0.5 text-right text-black text-[10px]">
                              <div className="flex justify-between">
                                <span>TOTAL MUATAN:</span>
                                <span>{popupTotals.loading} Unit</span>
                              </div>
                              <div className="flex justify-between">
                                <span>TOTAL Q:</span>
                                <span className="font-bold">{popupTotals.loadingQ} Q{popupTotals.loadingTotalQ !== popupTotals.loadingQ ? ` (Setara ${popupTotals.loadingTotalQ.toFixed(1)} Q)` : ""}</span>
                              </div>
                              <div className="flex justify-between text-xs font-black pt-1 mt-1 border-t border-dotted border-black/50">
                                <span>TOTAL RUPIAH:</span>
                                <span>{formatRupiah(popupTotals.loadingGrandTotal)}</span>
                              </div>
                            </div>

                            {/* Footnote */}
                            <div className="text-center mt-5 pt-2 border-t border-dashed border-black">
                              <p className="m-0 font-bold tracking-widest text-[10px]">TERIMA KASIH</p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              );
            })()
          ) : (
            <>
              {/* Metadata Controls Panel */}
              <div className={`bg-white rounded-2xl shadow-xs p-5 border border-slate-200/80 mb-6 grid grid-cols-1 ${activeMode === "loading" ? "md:grid-cols-2" : "md:grid-cols-3"} gap-5`}>
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <div />
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductSettings(true);
                      setSettingsActiveTab("sales");
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Atur Sales</span>
                  </button>
                </div>
                
                {activeMode === "penjualan" && (
                  loadedSalesForDate.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {loadedSalesForDate.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setSalesName(name)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                              salesName === name
                                ? "bg-indigo-600 text-white shadow-sm font-extrabold"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            <User className="w-3 h-3" />
                            <span>{name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-rose-500 font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-xl mb-3">
                      ⚠️ Belum ada sales yang muat barang pada tanggal ini!
                    </p>
                  )
                )}

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-[9px] font-black text-slate-400 w-full uppercase tracking-wider block">⚡ Input Muatan Cepat:</span>
                  {salesPeople.length === 0 ? (
                    <span className="text-[9px] text-slate-400 font-semibold italic">Belum ada sales terdaftar</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {salesPeople.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => openMuatanPopupForSales(name)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer hover:scale-[1.03] active:scale-[0.97] border border-indigo-100/30"
                          title={`Klik untuk input muatan ${name}`}
                        >
                          <Plus className="w-2.5 h-2.5 text-indigo-500" />
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {activeMode === "penjualan" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-500" /> Nama Toko
                  </label>
                  <input 
                    type="text" 
                    id="input-toko"
                    value={tokoName === "LOADING_STOK" ? "" : tokoName} 
                    onChange={(e) => setTokoName(e.target.value)}
                    placeholder="Masukkan nama toko..."
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Tanggal & Waktu
                </label>
                <input 
                  type="datetime-local" 
                  id="input-tanggal"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Transaction Input (Span 8 or 12 depending on mode) */}
          <div className={`${activeMode === "loading" ? "lg:col-span-8" : "lg:col-span-12"} bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden`}>
            {activeMode === "loading" ? (
              <>
                {/* Header */}
                <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <Truck className="h-5 w-5" />
                      </div>
                      <span>Daftar Muatan Sales ({tanggal ? getOnlyDateStr(tanggal) : ""})</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Menampilkan status muatan barang gudang untuk masing-masing sales pada tanggal ini.
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {salesPeople.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500">Belum ada sales terdaftar</p>
                      <button 
                        onClick={() => setShowSalesSettings(true)}
                        className="mt-2 text-xs font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        Atur Daftar Sales
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {salesPeople.map((name) => {
                        const datePart = tanggal ? getOnlyDateStr(tanggal) : getOnlyDateStr(new Date().toISOString());
                        const record = historyRecords.find(r => {
                          const rDatePart = getOnlyDateStr(r.rawDate || r.date);
                          return rDatePart === datePart && r.salesName === name && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
                        });
                        
                        const hasLoaded = !!record;
                        const totalPcs = record?.items.reduce((sum, it) => sum + it.loading, 0) || 0;
                        
                        return (
                          <div 
                            key={name}
                            className={`rounded-2xl border p-4.5 flex flex-col justify-between gap-3.5 transition-all ${
                              hasLoaded 
                                ? "bg-indigo-50/30 border-indigo-200/80 shadow-3xs" 
                                : "bg-white border-slate-200 hover:border-slate-300/80 shadow-3xs"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                                  <User className="w-4 h-4 text-indigo-500" />
                                  <span>{name}</span>
                                </h4>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                                  hasLoaded 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" 
                                    : "bg-amber-50 text-amber-600 border border-amber-100/50"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${hasLoaded ? "bg-emerald-500" : "bg-amber-400"}`} />
                                  <span>{hasLoaded ? "Sudah Muat" : "Belum Muat"}</span>
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {hasLoaded ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openMuatanPopupForSales(name)}
                                      className="p-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200/80 rounded-lg hover:border-indigo-200 transition-colors cursor-pointer"
                                      title="Edit Muatan"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteMuatanRecord(name)}
                                      className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200/80 rounded-lg hover:border-rose-200 transition-colors cursor-pointer"
                                      title="Hapus / Reset Muatan"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openMuatanPopupForSales(name)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Input Muatan</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Ringkasan Loading Per Sales */}
                            {hasLoaded && record.items && record.items.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/40 text-[10px] sm:text-xs">
                                <div className="bg-white rounded-lg p-1.5 border border-indigo-50 flex flex-col items-center justify-center">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jenis Barang</span>
                                  <span className="font-extrabold text-slate-700">{record.items.filter(it => it.loading > 0).length} Item</span>
                                </div>
                                <div className="bg-white rounded-lg p-1.5 border border-indigo-50 flex flex-col items-center justify-center">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nilai Muatan</span>
                                  <span className="font-extrabold text-indigo-700 font-mono">
                                    {formatRupiah(record.items.reduce((sum, it) => sum + (it.loading * (it.price || 0)), 0))}
                                  </span>
                                </div>
                              </div>
                            )}



                            {/* Collapsible Struk */}
                            {hasLoaded && record && record.items && record.items.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedStrukSales(prev => 
                                      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                                    );
                                  }}
                                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs hover:scale-[1.01] active:scale-95"
                                >
                                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{expandedStrukSales.includes(name) ? "Sembunyikan Struk" : "📄 Lihat / Cetak Struk"}</span>
                                </button>

                                {expandedStrukSales.includes(name) && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex flex-col gap-3 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Eye className="w-3 h-3 text-slate-500" /> PREVIEW STRUK ({name})
                                      </span>
                                      <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono uppercase font-black tracking-wider">THERMAL</span>
                                    </div>

                                    {/* Actual Struk Element to Capture */}
                                    <div className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                                      <div
                                        id={`receipt-capture-${record.id}`}
                                        className="p-4 font-mono text-[11px] leading-relaxed text-black select-all"
                                        style={{ wordBreak: "break-word", backgroundColor: "#ffffff", color: "#000000" }}
                                      >
                                        {/* Header */}
                                        <div className="text-center mb-3">
                                          <h2 className="text-xs font-black tracking-wider uppercase m-0 text-black">
                                            {tokoName || "TK PPJ"}
                                          </h2>
                                          <p className="m-0 text-[8px] font-bold text-slate-600 mt-0.5 uppercase">
                                            REKAP LOADING STOK
                                          </p>
                                          <div className="my-1.5 border-b border-dashed border-black" />
                                        </div>

                                        {/* Meta */}
                                        <div className="space-y-0.5 mb-2 text-[10px] text-black">
                                          <div className="flex justify-between text-black font-semibold">
                                            <span>KODE NOTA:</span>
                                            <span className="font-extrabold font-mono text-xs">{getReceiptUniqueId(record.isLoadingRecord ? "loading" : "penjualan", record.salesName, record.tokoName, record.rawDate || record.date)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>SALES:</span>
                                            <span className="font-bold">{name}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>TANGGAL:</span>
                                            <span className="font-bold">{getOnlyDateStr(record.rawDate || record.date)}</span>
                                          </div>
                                        </div>

                                        <div className="my-1.5 border-b border-dashed border-black" />

                                        {/* Table */}
                                        <table className="w-full text-left text-[10px] border-collapse text-black">
                                          <thead>
                                            <tr className="font-bold border-b border-dashed border-black">
                                              <th className="pb-1 text-left w-5">NO</th>
                                              <th className="pb-1 text-left">BARANG</th>
                                              <th className="pb-1 text-center w-10">LOAD</th>
                                              <th className="pb-1 text-right w-16 font-semibold">HARGA</th>
                                              <th className="pb-1 text-right w-18 font-semibold">TOTAL</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {record.items.map((it, idx) => {
                                              const prod = products.find(p => p.name === it.name);
                                              const conv = prod?.conv || 1;
                                              const bsr = Math.floor(it.loading / conv);
                                              const sdg = it.loading % conv;
                                              const loadBreakdown = getBreakdownString(it.name, it.loading, false);
                                              
                                              return (
                                                <React.Fragment key={it.name}>
                                                  <tr className="border-t border-dotted border-black/30">
                                                    <td className="py-1 text-left font-mono">{idx + 1}</td>
                                                    <td className="py-1 pr-1 font-bold truncate max-w-[95px]" title={it.name}>{it.name}</td>
                                                    <td className="py-1 text-center font-mono">{it.loading}</td>
                                                    <td className="py-1 text-right font-mono">{formatRupiah(it.price || 0).replace("Rp ", "")}</td>
                                                    <td className="py-1 text-right font-mono">{formatRupiah(it.loading * (it.price || 0)).replace("Rp ", "")}</td>
                                                  </tr>
                                                  <tr>
                                                    <td colSpan={5} className="text-[8px] text-slate-500 pb-1 font-sans">
                                                      <span>Detail: {loadBreakdown}</span>
                                                    </td>
                                                  </tr>
                                                </React.Fragment>
                                              );
                                            })}
                                          </tbody>
                                        </table>

                                        <div className="my-1.5 border-b border-dashed border-black" />

                                        {/* Totals */}
                                        <div className="space-y-0.5 text-right text-black">
                                          <div className="flex justify-between text-[10px]">
                                            <span>TOTAL UNIT:</span>
                                            <span>{record.items.reduce((sum, it) => sum + it.loading, 0)} Pcs</span>
                                          </div>
                                          <div className="flex justify-between text-xs font-black pt-1 mt-1 border-t border-dotted border-black/50">
                                            <span>TOTAL RUPIAH:</span>
                                            <span>{formatRupiah(record.items.reduce((sum, it) => sum + (it.loading * (it.price || 0)), 0))}</span>
                                          </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="text-center mt-4 pt-1.5 border-t border-dashed border-black">
                                          <p className="m-0 font-bold tracking-widest text-[9px] text-black">TERIMA KASIH</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Receipt Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => sendRecordToWhatsApp(record)}
                                        className="flex items-center justify-center gap-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span>Kirim Teks WA</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => generateReceiptImageForRecord(record)}
                                        className="flex items-center justify-center gap-1 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Kirim Nota Gambar</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (() => {
              const datePart = tanggal ? getOnlyDateStr(tanggal) : getOnlyDateStr(new Date().toISOString());
              const currentToko = tokoName || "TK PPJ";
              const savedPenjualanRecord = historyRecords.find(r => {
                const rDatePart = getOnlyDateStr(r.rawDate || r.date);
                return rDatePart === datePart && 
                       r.salesName === salesName && 
                       r.tokoName === currentToko && 
                       !r.isLoadingRecord && 
                       r.tokoName !== "LOADING_STOK";
              });

              if (savedPenjualanRecord && !isEditingSavedPenjualan) {
                const recordRevenue = savedPenjualanRecord.items.reduce((acc, it) => acc + (it.qty * it.price), 0);
                const recordSold = savedPenjualanRecord.items.reduce((acc, it) => acc + it.qty, 0);
                const recordRetur = savedPenjualanRecord.items.reduce((acc, it) => acc + it.retur, 0);

                return (
                  <div className="p-6 space-y-6 animate-fade-in bg-white">
                    {/* Header inside the saved view card */}
                    <div className="bg-emerald-50/40 border border-emerald-150 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0">
                          <CheckCircle className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-base flex flex-wrap items-center gap-2">
                            <span>Rekap Penjualan Terdaftar & Tersimpan</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Sudah Simpan</span>
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                            Data rekap penjualan untuk sales <strong className="text-slate-800 font-bold">{salesName}</strong> di toko <strong className="text-slate-800 font-bold">{tokoName || "TK PPJ"}</strong> sudah aman tersimpan di Server & Histori.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            restoreHistoryRecord(savedPenjualanRecord);
                            setIsEditingSavedPenjualan(true);
                          }}
                          className="px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Penjualan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Apakah Anda yakin ingin menghapus rekap penjualan ini dari server?")) {
                              deleteHistoryRecord(savedPenjualanRecord.id);
                            }
                          }}
                          className="p-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-xl transition-all cursor-pointer hover:border-rose-200 active:scale-95 shadow-3xs"
                          title="Hapus / Reset Penjualan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Jenis Barang</span>
                        <span className="font-extrabold text-slate-700 text-base">{savedPenjualanRecord.items.filter(it => it.qty > 0).length} Item</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Terjual</span>
                        <span className="font-extrabold text-emerald-600 font-mono text-base">{recordSold} Pcs</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Retur</span>
                        <span className="font-extrabold text-amber-600 font-mono text-base">{recordRetur} Pcs</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center justify-center text-center font-semibold">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Omset</span>
                        <span className="font-black text-indigo-600 font-mono text-base">
                          {formatRupiah(recordRevenue)}
                        </span>
                      </div>
                    </div>



                    {/* Collapsible Struk preview for saved penjualan record */}
                    <div className="mt-4 pt-4 border-t border-slate-150 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedStrukSales(prev => 
                            prev.includes(salesName) ? prev.filter(n => n !== salesName) : [...prev, salesName]
                          );
                        }}
                        className="flex items-center justify-center gap-1.5 w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-xs font-black rounded-xl transition-all cursor-pointer shadow-3xs hover:scale-[1.005] active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{expandedStrukSales.includes(salesName) ? "Sembunyikan Struk" : "📄 Lihat / Cetak Struk Penjualan"}</span>
                      </button>

                      {expandedStrukSales.includes(salesName) && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col gap-4 animate-fade-in max-w-md mx-auto w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Eye className="w-3 h-3 text-slate-500" /> PREVIEW STRUK ({salesName})
                            </span>
                            <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono uppercase font-black tracking-wider">THERMAL</span>
                          </div>

                          <div className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                            <div
                              id={`receipt-capture-${savedPenjualanRecord.id}`}
                              className="p-4 font-mono text-[11px] leading-relaxed text-black select-all"
                              style={{ wordBreak: "break-word", backgroundColor: "#ffffff", color: "#000000" }}
                            >
                              {/* Header */}
                              <div className="text-center mb-3">
                                <h2 className="text-xs font-black tracking-wider uppercase m-0 text-black">
                                  {savedPenjualanRecord.tokoName || "TK PPJ"}
                                </h2>
                                <p className="m-0 text-[8px] font-bold text-slate-600 mt-0.5 uppercase">
                                  REKAP PENJUALAN SALES
                                </p>
                                <div className="my-1.5 border-b border-dashed border-black" />
                              </div>

                              {/* Meta */}
                              <div className="space-y-0.5 mb-2 text-[10px] text-black">
                                <div className="flex justify-between text-black font-semibold">
                                  <span>KODE NOTA:</span>
                                  <span className="font-extrabold font-mono text-xs">{getReceiptUniqueId("penjualan", savedPenjualanRecord.salesName, savedPenjualanRecord.tokoName, savedPenjualanRecord.rawDate || savedPenjualanRecord.date)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>SALES:</span>
                                  <span className="font-bold">{salesName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>TANGGAL:</span>
                                  <span className="font-bold">{getOnlyDateStr(savedPenjualanRecord.rawDate || savedPenjualanRecord.date)}</span>
                                </div>
                              </div>

                              <div className="my-1.5 border-b border-dashed border-black" />

                              {/* Table */}
                              <table className="w-full text-left text-[10px] border-collapse text-black">
                                <thead>
                                  <tr className="font-bold border-b border-dashed border-black">
                                    <th className="pb-1 text-left w-5">NO</th>
                                    <th className="pb-1 text-left">BARANG</th>
                                    <th className="pb-1 text-center w-11">LOAD</th>
                                    <th className="pb-1 text-center w-11">JUAL</th>
                                    <th className="pb-1 text-center w-11">RETUR</th>
                                    <th className="pb-1 text-right w-16 font-semibold">TOTAL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {savedPenjualanRecord.items.map((it, idx) => {
                                    const total = it.qty * it.price;
                                    const loadBreakdown = getBreakdownString(it.name, it.loading, true);
                                    const returBreakdown = getBreakdownString(it.name, it.retur, true);
                                    const prod = products.find(p => p.name === it.name);
                                    const unitSdgLabel = prod?.unitSdg ?? "Pcs";

                                    return (
                                      <React.Fragment key={it.name}>
                                        <tr className="border-t border-dotted border-black/30">
                                          <td className="py-1 text-left font-mono">{idx + 1}</td>
                                          <td className="py-1 pr-1 font-bold truncate max-w-[85px]" title={it.name}>{it.name}</td>
                                          <td className="py-1 text-center font-mono">{it.loading}</td>
                                          <td className="py-1 text-center font-mono font-bold">{it.qty}</td>
                                          <td className="py-1 text-center font-mono">{it.retur}</td>
                                          <td className="py-1 text-right font-mono">{formatRupiah(total).replace("Rp ", "")}</td>
                                        </tr>
                                        <tr>
                                          <td colSpan={6} className="text-[8px] text-slate-500 pb-1 font-sans">
                                            <span>Harga: {formatRupiah(it.price)}/{unitSdgLabel} | Load: {loadBreakdown} | Sisa: {returBreakdown}</span>
                                          </td>
                                        </tr>
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>

                              <div className="my-1.5 border-b border-dashed border-black" />

                              {/* Totals */}
                              <div className="space-y-0.5 text-right text-black">
                                <div className="flex justify-between text-xs font-black pt-1 mt-1 border-t border-dotted border-black/50">
                                  <span>GRAND TOTAL:</span>
                                  <span>{formatRupiah(recordRevenue)}</span>
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="text-center mt-4 pt-1.5 border-t border-dashed border-black">
                                <p className="m-0 font-bold tracking-widest text-[9px] text-black">TERIMA KASIH</p>
                              </div>
                            </div>
                          </div>

                          {/* Receipt Action Buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => sendRecordToWhatsApp(savedPenjualanRecord)}
                              className="flex items-center justify-center gap-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Kirim Teks WA</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => generateReceiptImageForRecord(savedPenjualanRecord)}
                              className="flex items-center justify-center gap-1 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Kirim Nota Gambar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <>
                  {/* Penjualan Mode Header */}
                <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <Calculator className="h-4.5 w-4.5" />
                    </div>
                    <span>Input Penjualan & Hitung Retur</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hanya menampilkan barang yang dimuat (Load &gt; 0). Sisa (retur) dihitung otomatis.
                  </p>
                </div>

                {/* Interactive Data Table (Desktop - Penjualan Mode) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200 tracking-wider">
                        <th className="py-3.5 px-4 w-12 text-center font-semibold">No</th>
                        <th className="py-3.5 px-4 font-semibold min-w-[180px]">Nama Barang</th>
                        <th className="py-3.5 px-3 text-center w-24 bg-blue-50/20 font-semibold">Load</th>
                        <th className="py-3.5 px-3 text-center w-64 font-semibold">Input Terjual</th>
                        <th className="py-3.5 px-4 text-right w-28 bg-amber-50/20 font-semibold">Harga</th>
                        <th className="py-3.5 px-3 text-center w-24 font-semibold">Sisa (Retur)</th>
                        <th className="py-3.5 px-4 text-right w-32 font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium">
                      {items.filter(item => item.loading > 0).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-semibold">
                            ⚠️ Belum ada barang yang dimuat. Silakan isi "Jumlah Load" di tab <strong>Input Loading</strong> terlebih dahulu.
                          </td>
                        </tr>
                      ) : (
                        items.filter(item => item.loading > 0).map((item, index) => {
                          const prod = products.find(p => p.name === item.name);
                          const itemTotal = item.qty * item.price;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-center text-slate-500 font-mono text-sm md:text-base font-bold">
                                {index + 1}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm md:text-base font-black text-slate-900 block whitespace-normal break-words leading-tight">
                                  {item.name}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center bg-blue-50/10">
                                <div className="flex flex-col items-center">
                                  <span className="inline-block bg-blue-50 text-blue-700 border border-blue-150 rounded-lg py-1 px-3 text-xs font-extrabold font-mono min-w-10">
                                    {item.loading} Pcs
                                  </span>
                                  <span className="text-[9px] text-blue-600 font-semibold font-mono mt-0.5">{getBreakdownString(item.name, item.loading)}</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <div className="flex gap-2 justify-center items-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{prod?.unitBsr ?? "Q"}</span>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateNumericField(item.id, "qtyBsr", Math.max(0, item.qtyBsr - 1))}
                                        className="w-5 h-5 flex items-center justify-center text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0 shadow-3xs"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number" 
                                        min="0"
                                        value={item.qtyBsr === 0 ? "" : item.qtyBsr}
                                        placeholder="0"
                                        onChange={(e) => updateNumericField(item.id, "qtyBsr", parseInt(e.target.value) || 0)}
                                        className="w-10 text-center bg-white border border-slate-200 focus:border-indigo-500 rounded-md py-0.5 text-[11px] font-bold font-mono text-slate-800 shadow-3xs"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => updateNumericField(item.id, "qtyBsr", item.qtyBsr + 1)}
                                        className="w-5 h-5 flex items-center justify-center text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0 shadow-3xs"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">{prod?.unitSdg ?? "Sdg"}</span>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateNumericField(item.id, "qtySdg", Math.max(0, item.qtySdg - 1))}
                                        className="w-5 h-5 flex items-center justify-center text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0 shadow-3xs"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number" 
                                        min="0"
                                        value={item.qtySdg === 0 ? "" : item.qtySdg}
                                        placeholder="0"
                                        onChange={(e) => updateNumericField(item.id, "qtySdg", parseInt(e.target.value) || 0)}
                                        className="w-10 text-center bg-white border border-slate-200 focus:border-indigo-500 rounded-md py-0.5 text-[11px] font-bold font-mono text-slate-800 shadow-3xs"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => updateNumericField(item.id, "qtySdg", item.qtySdg + 1)}
                                        className="w-5 h-5 flex items-center justify-center text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0 shadow-3xs"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {item.qty > 0 && (
                                  <div className="text-[9px] text-emerald-600 font-bold font-mono mt-0.5 text-center leading-none">
                                    Total: {item.qty} Pcs
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right bg-amber-50/10">
                                <div className="flex flex-col items-end">
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={item.price}
                                    onChange={(e) => updateNumericField(item.id, "price", parseInt(e.target.value) || 0)}
                                    className="w-24 text-right bg-white border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-1 px-2 text-xs font-bold font-mono text-slate-700"
                                  />
                                  <span className="text-[7px] font-bold text-amber-600 uppercase mt-0.5 font-sans leading-none">
                                    per {prod?.unitSdg ?? "Pcs"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <div className="flex flex-col items-center">
                                  <span className={`inline-block min-w-16 text-center py-1.5 px-2 rounded-lg text-xs font-bold font-mono ${
                                    item.retur > 0 ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-slate-100 text-slate-400"
                                  }`}>
                                    {item.retur} Pcs
                                  </span>
                                  <span className="text-[9px] text-amber-600 font-semibold font-mono mt-0.5">{getBreakdownString(item.name, item.retur)}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 text-xs">
                                {itemTotal > 0 ? formatRupiah(itemTotal) : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (Optimized for Mobile Screens - Penjualan Mode) */}
                <div className="block md:hidden p-4 space-y-3">
                  {items.filter(item => item.loading > 0).length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                      ⚠️ Belum ada barang yang dimuat. Silakan isi "Jumlah Load" di tab <strong>Input Loading</strong> terlebih dahulu.
                    </div>
                  ) : (
                    items.filter(item => item.loading > 0).map((item, index) => {
                      const prod = products.find(p => p.name === item.name);
                      const itemTotal = item.qty * item.price;
                      return (
                        <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex justify-between items-start pb-2 border-b border-slate-100 gap-2">
                            <span className="text-sm font-black text-slate-900 whitespace-normal break-words leading-tight">
                              {item.name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 font-mono shrink-0">#{index + 1}</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-blue-50/50 p-1.5 rounded-lg border border-blue-100 flex flex-col justify-between min-h-[56px]">
                              <div>
                                <p className="text-[9px] font-bold text-blue-500 uppercase">Load</p>
                                <p className="font-mono font-black text-blue-900 mt-0.5">{item.loading}</p>
                              </div>
                              <p className="text-[8px] text-blue-600 font-semibold font-mono mt-0.5 leading-tight break-words">{getBreakdownString(item.name, item.loading)}</p>
                            </div>
                            <div className="bg-emerald-50/20 p-1.5 rounded-lg border border-slate-100 flex flex-col justify-between min-h-[56px]">
                              <div>
                                <p className="text-[9px] font-bold text-emerald-600 uppercase">Terjual</p>
                                <p className="font-mono font-black text-emerald-950 mt-0.5">{item.qty}</p>
                              </div>
                              <p className="text-[8px] text-emerald-600 font-semibold font-mono mt-0.5 leading-tight break-words">{getBreakdownString(item.name, item.qty)}</p>
                            </div>
                            <div className="bg-amber-50/20 p-1.5 rounded-lg border border-slate-100 flex flex-col justify-between min-h-[56px]">
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Sisa (Retur)</p>
                                <p className={`font-mono font-black mt-1 ${item.retur > 0 ? "text-amber-600" : "text-slate-400"}`}>{item.retur}</p>
                              </div>
                              <p className="text-[8px] text-amber-600 font-semibold font-mono mt-0.5 leading-tight break-words">{getBreakdownString(item.name, item.retur)}</p>
                            </div>
                          </div>

                          {/* Mobile sales input (Q & Small Unit) */}
                          <div className="bg-emerald-50/5 p-2 rounded-xl border border-emerald-100/50 space-y-1">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Input Penjualan:</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="flex flex-col items-center bg-white p-1.5 rounded-lg border border-slate-150 w-full">
                                <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">{prod?.unitBsr ?? "Q"}</span>
                                <div className="flex items-center w-full gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => updateNumericField(item.id, "qtyBsr", Math.max(0, item.qtyBsr - 1))}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={item.qtyBsr === 0 ? "" : item.qtyBsr}
                                    placeholder="0"
                                    onChange={(e) => updateNumericField(item.id, "qtyBsr", parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-transparent focus:outline-hidden text-xs font-black font-mono text-slate-800 min-w-0"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => updateNumericField(item.id, "qtyBsr", item.qtyBsr + 1)}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-center bg-white p-1.5 rounded-lg border border-slate-150 w-full">
                                <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">{prod?.unitSdg ?? "Sdg"}</span>
                                <div className="flex items-center w-full gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => updateNumericField(item.id, "qtySdg", Math.max(0, item.qtySdg - 1))}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={item.qtySdg === 0 ? "" : item.qtySdg}
                                    placeholder="0"
                                    onChange={(e) => updateNumericField(item.id, "qtySdg", parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-transparent focus:outline-hidden text-xs font-black font-mono text-slate-800 min-w-0"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => updateNumericField(item.id, "qtySdg", item.qtySdg + 1)}
                                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all select-none cursor-pointer shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400">Harga: </span>
                              <input 
                                type="number" 
                                min="0"
                                value={item.price}
                                onChange={(e) => updateNumericField(item.id, "price", parseInt(e.target.value) || 0)}
                                className="w-20 text-right bg-white border border-slate-200 rounded-md px-1 py-0.5 font-mono text-[11px] text-slate-700"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400">Total: </span>
                              <span className="font-bold text-slate-800 font-mono">{formatRupiah(itemTotal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Action Buttons for Unsaved Penjualan */}
                <div className="p-5 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Grand Total Penjualan</p>
                    <p className="text-xl font-black text-emerald-700 font-sans tracking-tight">
                      {formatRupiah(totals.grandTotal)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl font-bold text-xs transition-colors cursor-pointer text-center active:scale-95"
                    >
                      Reset Semua Inputan
                    </button>
                    <button
                      type="button"
                      onClick={saveToLocalHistory}
                      className={`w-full sm:w-auto px-6 py-2.5 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 ${
                        historySuccess 
                          ? "bg-emerald-600 shadow-emerald-600/15" 
                          : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15"
                      }`}
                    >
                      {historySuccess ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Berhasil Disimpan!</span>
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 text-indigo-200" />
                          <span>Simpan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )})()}

            {/* Quick Helper Banner */}
            <div className="p-4 bg-indigo-50/50 border-t border-slate-100 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              {activeMode === "loading" ? (
                <p className="text-xs text-indigo-900 leading-relaxed">
                  <strong>Tips Loading:</strong> Masukkan jumlah muatan mula-mula yang dimuat sales ke kolom input barang. Gunakan kartu <strong>'Tambah Barang'</strong> di bawah list untuk memasukkan produk lainnya ke dalam muatan.
                </p>
              ) : (
                <p className="text-xs text-indigo-900 leading-relaxed">
                  <strong>Tips Penjualan:</strong> Masukkan jumlah barang yang laku terjual di kolom <span className="font-semibold text-indigo-700">Terjual</span>. Kolom <span className="font-semibold text-amber-700">Sisa (Retur)</span> otomatis terhitung dari stok Load awal Anda agar tidak perlu kalkulasi manual.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Actions & Live Preview (Span 4) */}
          {activeMode === "loading" && (
            <div className="lg:col-span-4 space-y-6">
              {/* 1. Live Preview (Rendered first if activeMode is penjualan) */}
            {activeMode === "penjualan" && (
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-100/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> LIVE PREVIEW STRUK:
                  </p>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">Thermal paper layout</span>
                </div>
                
                {/* Receipt Body Frame */}
                <div className="receipt-paper border border-slate-300 shadow-sm rounded-lg overflow-hidden bg-white">
                  <div 
                    ref={receiptRef} 
                    id="receipt-capture-target"
                    className="receipt-paper p-4 font-mono text-[11px] leading-relaxed select-all"
                    style={{ wordBreak: "break-word" }}
                  >
                    {/* Receipt Header */}
                    <div className="text-center mb-3">
                      <h2 className="text-sm font-bold tracking-wider uppercase m-0" style={{ color: "#000" }}>
                        {tokoName || "TK PPJ"}
                      </h2>
                      <p className="m-0 text-[9px] font-semibold text-slate-600 mt-0.5">
                        {activeMode === "loading" ? "REKAP LOADING" : "REKAP PENJUALAN SALES"}
                      </p>
                      <div className="my-2 border-b border-dashed border-black" />
                    </div>

                    {/* Metadata block */}
                    <div className="space-y-0.5 mb-2 text-[10px]">
                      <div className="flex justify-between text-black font-semibold">
                        <span>KODE NOTA:</span>
                        <span className="font-extrabold font-mono text-xs">{getReceiptUniqueId(activeMode, salesName, tokoName || "TK_PPJ", tanggal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SALES:</span>
                        <span className="font-bold">{salesName || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TANGGAL:</span>
                        <span>{formatSimpleDate(tanggal)}</span>
                      </div>
                    </div>
                    
                    <div className="my-2 border-b border-dashed border-black" />

                    {/* Items list */}
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead>
                        <tr className="font-bold border-b border-dashed border-black">
                          <th className="pb-1 text-left w-5">NO</th>
                          <th className="pb-1 text-left">BARANG</th>
                          <th className="pb-1 text-center w-11">LOAD</th>
                          {activeMode === "penjualan" ? (
                            <>
                              <th className="pb-1 text-center w-11">JUAL</th>
                              <th className="pb-1 text-center w-11">RETUR</th>
                              <th className="pb-1 text-right w-16">TOTAL</th>
                            </>
                          ) : (
                            <>
                              <th className="pb-1 text-right w-16">HARGA</th>
                              <th className="pb-1 text-right w-18">TOTAL</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let serialNum = 0;
                          return items.map((item, idx) => {
                            if (activeMode === "loading" ? item.loading > 0 : (item.qty > 0 || item.loading > 0 || item.retur > 0)) {
                              serialNum++;
                              const total = item.qty * item.price;
                              const loadBreakdown = getBreakdownString(item.name, item.loading, activeMode === "penjualan");
                              const returBreakdown = getBreakdownString(item.name, item.retur, activeMode === "penjualan");
                              const prod = products.find(p => p.name === item.name);
                              const unitSdgLabel = prod?.unitSdg ?? "Pcs";
                              return (
                                <React.Fragment key={item.id || idx}>
                                  <tr className="border-t border-dotted border-black/30">
                                    <td className="py-1 text-left text-slate-500 font-mono">{serialNum}</td>
                                    <td className="py-1 pr-1 font-bold truncate max-w-[90px]">{item.name}</td>
                                    <td className="py-1 text-center font-mono">{item.loading}</td>
                                    {activeMode === "penjualan" ? (
                                      <>
                                        <td className="py-1 text-center font-mono font-bold">{item.qty}</td>
                                        <td className="py-1 text-center font-mono">{item.retur}</td>
                                        <td className="py-1 text-right font-mono">{formatRupiah(total).replace("Rp ", "")}</td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="py-1 text-right font-mono">{formatRupiah(item.price).replace("Rp ", "")}</td>
                                        <td className="py-1 text-right font-mono">{formatRupiah(item.loading * item.price).replace("Rp ", "")}</td>
                                      </>
                                    )}
                                  </tr>
                                  <tr>
                                    <td colSpan={activeMode === "penjualan" ? 6 : 5} className="text-[8px] text-slate-500 pb-1 font-sans">
                                      {activeMode === "loading" ? (
                                        <span>Detail: {loadBreakdown}</span>
                                      ) : (
                                        <span>Harga: {formatRupiah(item.price)}/{unitSdgLabel} | Detail Load: {loadBreakdown} | Sisa: {returBreakdown}</span>
                                      )}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            }
                            return null;
                          });
                        })()}
                      </tbody>
                    </table>

                    <div className="my-2 border-b border-dashed border-black" />

                    {/* Receipt totals */}
                    <div className="space-y-0.5 text-right">
                      {activeMode === "loading" ? (
                        <div className="pt-1.5 border-t border-dashed border-black">
                          <div className="flex justify-between text-[10px]">
                            <span>TOTAL MUATAN:</span>
                            <span>{totals.loading} Unit</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span>TOTAL Q:</span>
                            <span className="font-bold">{totals.loadingQ} Q{totals.loadingTotalQ !== totals.loadingQ ? ` (Setara ${totals.loadingTotalQ.toFixed(1)} Q)` : ""}</span>
                          </div>
                          <div className="flex justify-between text-xs font-black pt-1 mt-1 border-t border-dotted border-black/50">
                            <span>TOTAL RUPIAH:</span>
                            <span>{formatRupiah(totals.loadingGrandTotal)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-xs font-black pt-0.5">
                          <span>GRAND TOTAL:</span>
                          <span>{formatRupiah(totals.grandTotal)}</span>
                        </div>
                      )}
                    </div>

                    {/* Auto-compiled Return (Retur) Rincian list */}
                    {activeMode === "penjualan" && items.some((i) => i.retur > 0) && (
                      <div className="mt-3 text-[9px] text-left">
                        <div className="my-1 border-b border-dashed border-black" />
                        <span className="font-bold block uppercase tracking-wider mb-1">RINCIAN BARANG RETUR:</span>
                        <div className="space-y-0.5">
                          {items.map((item, idx) => {
                            if (item.retur > 0) {
                              return (
                                <div key={idx} className="flex justify-between text-slate-700">
                                  <span>- {item.name}</span>
                                  <span className="font-bold">{getBreakdownString(item.name, item.retur, true)} ({item.retur})</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footnote */}
                    <div className="text-center mt-5 pt-2 border-t border-dashed border-black">
                      <p className="m-0 font-bold tracking-widest text-[10px]">TERIMA KASIH</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Summary Box / Actions (Rendered below/after Live Preview) */}
            {activeMode === "loading" ? (
              /* Summary Box for Loading Mode */
              <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Ringkasan & Aksi Muatan</h3>
                      <p className="text-[10px] text-slate-400">Total status muatan sales hari ini</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs text-slate-600 space-y-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total Sales Terdaftar:</span>
                        <span className="text-slate-800 font-bold">{salesPeople.length} Orang</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Sudah Muat Barang:</span>
                        <span className="text-emerald-600 font-bold">
                          {salesPeople.filter(name => {
                            const datePart = tanggal ? getOnlyDateStr(tanggal) : getOnlyDateStr(new Date().toISOString());
                            return historyRecords.some(r => {
                              const rDatePart = getOnlyDateStr(r.rawDate || r.date);
                              return rDatePart === datePart && r.salesName === name && (r.isLoadingRecord || r.tokoName === "LOADING_STOK");
                            });
                          }).length} Sales
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold pt-1 border-t border-slate-100">
                        <span>Status Operasi:</span>
                        <span className="text-amber-600 font-bold flex items-center gap-1">⏱️ Menunggu Penjualan</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setActiveMode("penjualan")}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98] group"
                  >
                    Mulai Catat Penjualan
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ) : (
              /* Summary Box for Penjualan Mode */
              <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-5">
                <div className="space-y-3 mb-5">
                  <div className="p-4.5 bg-emerald-50 rounded-2xl border border-emerald-100/80 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-full blur-xl opacity-35" />
                    <span className="block text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest mb-1">Grand Total Penjualan</span>
                    <span className="text-2xl font-black text-emerald-800 font-sans tracking-tight">
                      {formatRupiah(totals.grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Stack */}
                <div className="space-y-2.5">
                  {/* Simpan Button (Database Lokal) */}
                  <button
                    onClick={saveToLocalHistory}
                    className={`w-full text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98] ${
                      historySuccess 
                        ? "bg-emerald-600 shadow-emerald-600/15" 
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15"
                    }`}
                  >
                    {historySuccess ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Berhasil Disimpan!</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 text-indigo-200" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>

                  {/* Kirim Nota via WA */}
                  <button 
                    onClick={generateReceiptImage}
                    disabled={downloading}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 text-emerald-400" />
                    {downloading ? "Memproses..." : "Kirim Nota via WA"}
                  </button>
                  
                  {/* Kirim Rekap via WA */}
                  <button 
                    onClick={sendToWhatsApp}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98]"
                  >
                    <Send className="h-4 w-4" />
                    Kirim Rekap via WA
                  </button>

                  {/* Google Sheets Integration Section */}
                  <div className="pt-3 border-t border-slate-100 mt-2 space-y-2">
                    {!token ? (
                      <button 
                        onClick={handleGoogleSignIn}
                        className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98]"
                      >
                        <Database className="w-4 h-4 text-emerald-600" />
                        Hubungkan ke Google Sheets
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-150 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                            <span className="font-semibold text-slate-600 truncate">{user?.displayName || "Google Terhubung"}</span>
                          </div>
                          <button 
                            onClick={handleGoogleSignOut}
                            className="text-[10px] text-slate-400 hover:text-rose-500 font-bold hover:underline transition-colors cursor-pointer shrink-0"
                          >
                            Putuskan
                          </button>
                        </div>
                        
                        <button 
                          onClick={saveToGoogleSheets}
                          disabled={sheetsSyncing}
                          className={`w-full text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm transition-all active:scale-[0.98] ${
                            sheetsSuccess 
                              ? "bg-emerald-600 shadow-emerald-600/15" 
                              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15"
                          }`}
                        >
                          {sheetsSyncing ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Menyimpan ke Google Sheets...
                            </>
                          ) : sheetsSuccess ? (
                            <>
                              <Check className="h-4 w-4 animate-bounce" />
                              Rekap Berhasil Disimpan!
                            </>
                          ) : (
                            <>
                              <Database className="h-4 w-4" />
                              Simpan Rekap ke Spreadsheet
                            </>
                          )}
                        </button>

                        {spreadsheetUrl && (
                          <a 
                            href={spreadsheetUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
                          >
                            <span>Buka Google Sheets ↗</span>
                          </a>
                        )}
                      </div>
                    )}

                    {sheetsError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[11px] rounded-lg flex items-center gap-1.5 leading-relaxed">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{sheetsError}</span>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors border border-dashed border-slate-200 hover:border-rose-200 mt-2"
                  >
                    Reset Semua Inputan
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </>
      )
        ) : activeTab === "histori" ? (
          <div className="space-y-6">
            {/* Filter controls */}
            <div className="bg-white rounded-2xl shadow-xs p-5 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Filter Tanggal (Cari)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    placeholder="Contoh: 29/06/2026 atau Senin..."
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner-sm"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" /> Filter Nama Sales
                </label>
                <select
                  value={filterSales}
                  onChange={(e) => setFilterSales(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner-sm cursor-pointer"
                >
                  <option value="">-- Semua Sales --</option>
                  {salesPeople.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* History Records List */}
            {filteredRecordsForMetrics.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
                <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-full">
                  <History className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800">Belum Ada Histori</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Belum ada data rekap penjualan yang tersimpan untuk filter yang Anda masukkan. Silakan buat rekap di tab <strong>"Transaksi"</strong> dan simpan ke Histori Lokal.
                </p>
                <button
                  onClick={() => setActiveTab("transaksi")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Buat Transaksi Sekarang
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredRecordsForMetrics.map((record) => {
                  // Calculate quick stats
                  const recordRevenue = record.items.reduce((acc, it) => acc + (it.qty * it.price), 0);
                  const recordLoading = record.items.reduce((acc, it) => acc + it.loading, 0);
                  const recordSold = record.items.reduce((acc, it) => acc + it.qty, 0);
                  const recordRetur = record.items.reduce((acc, it) => acc + it.retur, 0);

                  return (
                    <div key={record.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-lg">
                            📅 {formatFullDate(record.rawDate || record.date, record.date)}
                          </span>
                          <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <User className="w-3 h-3" /> {record.salesName}
                          </span>
                          {record.isLoadingRecord || record.tokoName === "LOADING_STOK" ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Box className="w-3 h-3 text-blue-600" /> MUATAN (GUDANG)
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Store className="w-3 h-3" /> {record.tokoName}
                            </span>
                          )}
                        </div>
                        
                        {record.isLoadingRecord || record.tokoName === "LOADING_STOK" ? (
                          <div className="grid grid-cols-1 gap-x-6 gap-y-1 pt-1">
                            <div className="text-xs text-slate-500">
                              Total Muatan Stok: <strong className="text-indigo-600 font-extrabold">{recordLoading} unit</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 pt-1">
                            <div className="text-xs text-slate-500">
                              Muatan: <strong className="text-slate-800 font-bold">{recordLoading} unit</strong>
                            </div>
                            <div className="text-xs text-slate-500">
                              Terjual: <strong className="text-emerald-600 font-extrabold">{recordSold} unit</strong>
                            </div>
                            <div className="text-xs text-slate-500">
                              Sisa / Retur: <strong className="text-rose-600 font-extrabold">{recordRetur} unit</strong>
                            </div>
                            <div className="text-xs text-slate-500">
                              Total Omset: <strong className="text-indigo-600 font-black">{formatRupiah(recordRevenue)}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Detail</span>
                        </button>
                        <button
                          onClick={() => restoreHistoryRecord(record)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Muat Form</span>
                        </button>
                        <button
                          onClick={() => deleteHistoryRecord(record.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter controls */}
            <div className="bg-white rounded-2xl shadow-xs p-5 border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Filter Bulan / Tanggal (Metrics)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    placeholder="Contoh: 29/06/2026 atau Juni..."
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner-sm"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" /> Filter Sales
                </label>
                <select
                  value={filterSales}
                  onChange={(e) => setFilterSales(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner-sm cursor-pointer"
                >
                  <option value="">-- Semua Sales --</option>
                  {salesPeople.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metric KPI Overview Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 border border-indigo-100 p-5 rounded-2xl shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                  💰 Omset Penjualan
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-indigo-950 mt-1">{formatRupiah(metricsData.totalRevenue)}</h3>
                <p className="text-[10px] text-indigo-500 mt-1">Total pendapatan bersih terjual</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-100 p-5 rounded-2xl shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                  📦 Volume Terjual
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-emerald-950 mt-1">{metricsData.totalSold} <span className="text-xs font-bold text-emerald-600">unit</span></h3>
                <p className="text-[10px] text-emerald-500 mt-1">Total barang laku terjual</p>
              </div>

              <div className="bg-gradient-to-br from-rose-50 to-rose-100/30 border border-rose-100 p-5 rounded-2xl shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                  ♻️ Sisa / Retur
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-rose-950 mt-1">{metricsData.totalReturned} <span className="text-xs font-bold text-rose-600">unit</span></h3>
                <p className="text-[10px] text-rose-500 mt-1">Total barang kembali ke gudang</p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-100 p-5 rounded-2xl shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                  📈 Efisiensi Muatan
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-amber-950 mt-1">
                  {metricsData.totalLoading > 0 
                    ? `${((metricsData.totalSold / metricsData.totalLoading) * 100).toFixed(1)}%` 
                    : "0.0%"}
                </h3>
                <p className="text-[10px] text-amber-500 mt-1">Rasio barang laku terhadap dimuat</p>
              </div>
            </div>

            {/* Charts Section */}
            {filteredRecordsForMetrics.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <p className="text-sm text-slate-500 font-bold">Tidak ada data untuk memuat grafik dashboard.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Tren Penjualan (Line Chart) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="text-indigo-500 w-4 h-4" /> Tren Penjualan Harian
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metricsData.dateChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip 
                          formatter={(value) => [formatRupiah(Number(value)), "Omset"]} 
                          contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                        />
                        <Line type="monotone" dataKey="Revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Performa Sales (Bar Chart) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart2 className="text-indigo-500 w-4 h-4" /> Performa Omset per Sales
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsData.salesChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip 
                          formatter={(value) => [formatRupiah(Number(value)), "Total Omset"]} 
                          contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                        />
                        <Bar dataKey="Revenue" fill="#6366f1" radius={[8, 8, 0, 0]}>
                          {metricsData.salesChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#4f46e5" : index % 2 === 0 ? "#818cf8" : "#c7d2fe"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Volume Produk Terlaris */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart2 className="text-indigo-500 w-4 h-4" /> Distribusi Barang: Muatan vs Terjual vs Retur
                  </h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricsData.productChartData} margin={{ bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, angle: -15, textAnchor: 'end' }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Loading" name="Muatan (Load)" fill="#94a3b8" opacity={0.6} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Sold" name="Terjual" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Retur" name="Retur / Sisa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Image Output Modal (Direct workaround for iframe download sandbox limitations!) */}
      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/15 rounded-md">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Nota Berhasil Dibuat!</h3>
                    <p className="text-[10px] text-slate-300">Konversi ke format Gambar Thermal Selesai</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImageModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Visual Instructions Banner */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 space-y-1">
                    <p className="font-bold">Cara Menyimpan Gambar di Ponsel & Komputer:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-emerald-800">
                      <li><strong>Ponsel / Tablet:</strong> Tekan lama pada gambar di bawah, lalu pilih <span className="font-bold">"Simpan Gambar"</span> atau <span className="font-bold">"Unduh Gambar"</span>.</li>
                      <li><strong>Komputer:</strong> Klik kanan pada gambar, lalu klik <span className="font-bold">"Simpan Gambar Sebagai..."</span>.</li>
                    </ul>
                  </div>
                </div>

                {/* Real Canvas Rendering Image Output */}
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex justify-center max-h-[320px] overflow-y-auto shadow-inner">
                  <img 
                    src={generatedImageUrl} 
                    alt="Generated Thermal Receipt" 
                    referrerPolicy="no-referrer"
                    className="max-w-full h-auto shadow-md border border-slate-300/80 rounded"
                    style={{ maxHeight: "280px" }}
                  />
                </div>

                {/* Primary WA Action */}
                <button
                  onClick={copyAndOpenWhatsApp}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm cursor-pointer shadow-md transition-all active:scale-[0.98] ${
                    copySuccess 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-emerald-100"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/15"
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-600 animate-bounce" />
                      Gambar Tersalin! Membuka WhatsApp...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 text-white" />
                      Salin Gambar & Buka WhatsApp
                    </>
                  )}
                </button>

                {/* Quick actions stack */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={copyImageToClipboard}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-[11px] cursor-pointer border transition-all ${
                      copySuccess 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        Hanya Salin Gambar
                      </>
                    )}
                  </button>

                  <button
                    onClick={downloadImageFile}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-2 px-3 rounded-xl text-[11px] cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    Unduh File Gambar
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowImageModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Dialog */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-100"
            >
              <div className="flex items-center gap-3 text-amber-600 mb-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="font-extrabold text-base text-slate-800">Kosongkan Inputan?</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Apakah Anda benar-benar yakin ingin mengosongkan dan mengulang penginputan barang? Seluruh baris transaksi saat ini akan dihapus dan diatur ulang ke default.
              </p>
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={resetForm}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl cursor-pointer"
                >
                  Ya, Reset Semua
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSalesSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-indigo-700 text-white px-5 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/10 rounded-md border border-white/15">
                    <UserPlus className="w-4 h-4 text-indigo-100" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Pengaturan Sales / Orang</h3>
                    <p className="text-[10px] text-indigo-200">Tambah, Edit, atau Hapus Daftar Sales</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowSalesSettings(false); setEditingSalesIndex(null); }}
                  className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1">
                {/* 1. Add New Sales Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-inner-sm">
                  <h4 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <PlusCircle className="w-4 h-4 text-indigo-600" /> Tambah Sales Baru
                  </h4>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Contoh: Budi Santoso" 
                      value={newSalesName}
                      onChange={(e) => setNewSalesName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addSalesPerson(newSalesName);
                        }
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button 
                      type="button"
                      onClick={() => addSalesPerson(newSalesName)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98] shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                </div>

                {/* 2. Sales List Management */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" /> Daftar Sales ({salesPeople.length} Orang)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {salesPeople.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-bold">
                        Belum ada sales terdaftar. Silakan tambahkan.
                      </div>
                    ) : (
                      salesPeople.map((name, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          {editingSalesIndex === idx ? (
                            <div className="flex items-center gap-2 w-full">
                              <input 
                                type="text"
                                value={editingSalesName}
                                onChange={(e) => setEditingSalesName(e.target.value)}
                                className="flex-1 bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditSalesPerson();
                                  if (e.key === "Escape") setEditingSalesIndex(null);
                                }}
                                autoFocus
                              />
                              <button 
                                onClick={saveEditSalesPerson}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-md text-[10px] transition-colors cursor-pointer"
                              >
                                Simpan
                              </button>
                              <button 
                                onClick={() => setEditingSalesIndex(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-extrabold px-2.5 py-1 rounded-md text-[10px] transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSalesSettings(false);
                                  openMuatanPopupForSales(name);
                                }}
                                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                                title={`Klik untuk input muatan ${name}`}
                              >
                                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{name}</span>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEditSalesPerson(idx)}
                                  className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Nama"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSalesPerson(idx)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Sales"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex justify-end items-center shrink-0">
                <button 
                  onClick={() => setShowSalesSettings(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-5 rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Settings & Management Modal */}
      <AnimatePresence>
        {showProductSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-indigo-700 text-white px-5 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/10 rounded-md border border-white/15">
                    <Settings className="w-4 h-4 text-indigo-100" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Pengaturan Produk & Harga</h3>
                    <p className="text-[10px] text-indigo-200">Tambah, Edit Harga, atau Hapus Produk Master</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowProductSettings(false)}
                  className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1">
                
                {/* 1. Add New Product Form */}
                <form onSubmit={handleAddProduct} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-inner-sm">
                  <h4 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <PlusCircle className="w-4 h-4 text-indigo-600" /> Tambah Produk Baru
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nama Barang</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: CHOKI CHOKI" 
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Harga (Rp)</label>
                      <input 
                        type="number" 
                        placeholder="5000" 
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Konv (1Q = ?)</label>
                      <input 
                        type="number" 
                        placeholder="12" 
                        value={newProdConv}
                        onChange={(e) => setNewProdConv(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Satuan Kecil</label>
                      <select
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Rcg">Rcg (Renceng)</option>
                        <option value="Zak">Zak</option>
                        <option value="Box">Box</option>
                        <option value="Tpl">TPL (Toples)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98] shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambahkan ke Daftar
                      </button>
                    </div>
                  </div>
                </form>

                {/* 2. Product Search & List Management */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wide">
                      Daftar Produk ({products.length})
                    </h4>
                    
                    {/* Search Field */}
                    <input 
                      type="text" 
                      placeholder="Cari nama produk..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="max-w-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-3xs"
                    />
                  </div>

                  {/* Products Table/Grid list */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-100/80 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 tracking-wider">
                          <th className="py-2.5 px-3">Nama Produk</th>
                          <th className="py-2.5 px-3 w-28">Harga (Rp)</th>
                          <th className="py-2.5 px-3 w-20">Konv</th>
                          <th className="py-2.5 px-3 w-24">Satuan Kecil</th>
                          <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {products
                          .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((prod) => (
                            <tr key={prod.name} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2 px-3 font-bold truncate max-w-[150px]" title={prod.name}>
                                {prod.name}
                              </td>
                              <td className="py-2 px-3">
                                <input 
                                  type="number" 
                                  value={prod.price}
                                  onChange={(e) => handleUpdateProductPrice(prod.name, parseInt(e.target.value) || 0)}
                                  className="w-full bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-md py-0.5 px-1.5 font-mono text-[11px] font-bold text-slate-800 shadow-3xs"
                                />
                              </td>
                              <td className="py-2 px-3 font-mono">
                                <input 
                                  type="number" 
                                  value={prod.conv}
                                  onChange={(e) => handleUpdateProductConv(prod.name, parseInt(e.target.value) || 1)}
                                  className="w-full bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-md py-0.5 px-1.5 font-mono text-[11px] font-bold text-slate-800 shadow-3xs"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={prod.unitSdg}
                                  onChange={(e) => handleUpdateProductUnit(prod.name, e.target.value)}
                                  className="w-full bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-md py-0.5 px-1 text-[11px] font-bold text-slate-800 shadow-3xs cursor-pointer"
                                >
                                  <option value="Pcs">Pcs</option>
                                  <option value="Rcg">Rcg</option>
                                  <option value="Zak">Zak</option>
                                  <option value="Box">Box</option>
                                  <option value="Tpl">Tpl</option>
                                </select>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.name)}
                                  className="text-rose-600 hover:text-white hover:bg-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 text-[11px]">
                              Tidak ada produk ditemukan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex justify-between items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("⚠️ Apakah Anda yakin ingin memulihkan seluruh produk ke pengaturan pabrik (26 default)? Tindakan ini akan menghapus seluruh produk kustom Anda.")) {
                      localStorage.removeItem("MASTER_PRODUCTS");
                      syncItemsWithProducts(MASTER_PRODUCTS);
                      alert("Sukses mengembalikan daftar produk ke default bawaan!");
                    }
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:underline transition-all cursor-pointer"
                >
                  Pulihkan Default (Bawaan)
                </button>
                <button 
                  onClick={() => setShowProductSettings(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-5 rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                >
                  Selesai & Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Selected Record Detail Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-slate-200 flex flex-col"
            >
              {/* Header */}
              <div className="bg-indigo-700 text-white px-5 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/10 rounded-md">
                    <FileText className="w-5 h-5 text-indigo-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base">Detail Rekap Histori</h3>
                    <p className="text-[10px] text-indigo-200">
                      Sales: <strong className="text-white font-bold">{selectedRecord.salesName}</strong> | Toko: <strong className="text-white font-bold">{selectedRecord.tokoName}</strong>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedRecord(null); setDetailSubTab("semua"); }}
                  className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-tab selection inside modal */}
              <div className="bg-slate-100 p-1 flex border-b border-slate-200 shrink-0 select-none">
                {(["semua", "loading", "penjualan", "retur"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailSubTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      detailSubTab === tab
                        ? "bg-white text-indigo-700 shadow-3xs font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "semua" ? "Semua" : tab === "loading" ? "Muatan (Load)" : tab === "penjualan" ? "Penjualan" : "Sisa (Retur)"}
                  </button>
                ))}
              </div>

              {/* Content body with scrolling */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Meta details */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
                  <div>Tanggal: <strong className="text-slate-800 font-bold">{formatFullDate(selectedRecord.rawDate || selectedRecord.date, selectedRecord.date)}</strong></div>
                  <div>Kode Nota: <strong className="text-indigo-700 font-mono font-bold text-xs">{getReceiptUniqueId(selectedRecord.isLoadingRecord ? "loading" : "penjualan", selectedRecord.salesName, selectedRecord.tokoName, selectedRecord.rawDate || selectedRecord.date)}</strong></div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs font-semibold">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Produk</th>
                        {detailSubTab === "semua" && <th className="py-2.5 px-3 text-center">Muat</th>}
                        {detailSubTab === "semua" && <th className="py-2.5 px-3 text-center">Terjual</th>}
                        {detailSubTab === "semua" && <th className="py-2.5 px-3 text-center">Sisa</th>}
                        
                        {detailSubTab === "loading" && <th className="py-2.5 px-3 text-center">Qty Muatan</th>}
                        {detailSubTab === "penjualan" && <th className="py-2.5 px-3 text-center">Qty Terjual</th>}
                        {detailSubTab === "retur" && <th className="py-2.5 px-3 text-center">Qty Sisa</th>}
                        
                        {(detailSubTab === "semua" || detailSubTab === "penjualan") && (
                          <>
                            <th className="py-2.5 px-3 text-right">Harga</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {selectedRecord.items
                        .filter(item => {
                          if (detailSubTab === "loading") return item.loading > 0;
                          if (detailSubTab === "penjualan") return item.qty > 0;
                          if (detailSubTab === "retur") return item.retur > 0;
                          return true;
                        })
                        .map((item, idx) => {
                          const subtotal = item.qty * item.price;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-800">{item.name}</td>
                              
                              {detailSubTab === "semua" && (
                                <>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">{getBreakdownString(item.name, item.loading, true)} ({item.loading})</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-800">{getBreakdownString(item.name, item.qty, true)} ({item.qty})</td>
                                  <td className={`py-2.5 px-3 text-center font-mono font-bold ${item.retur > 0 ? "text-rose-600" : "text-slate-400"}`}>{getBreakdownString(item.name, item.retur, true)} ({item.retur})</td>
                                </>
                              )}

                              {detailSubTab === "loading" && (
                                <td className="py-2.5 px-3 text-center font-mono text-slate-800 font-bold">{getBreakdownString(item.name, item.loading, true)} ({item.loading})</td>
                              )}
                              
                              {detailSubTab === "penjualan" && (
                                <td className="py-2.5 px-3 text-center font-mono text-emerald-600 font-bold">{getBreakdownString(item.name, item.qty, true)} ({item.qty})</td>
                              )}

                              {detailSubTab === "retur" && (
                                <td className="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">{getBreakdownString(item.name, item.retur, true)} ({item.retur})</td>
                              )}

                              {(detailSubTab === "semua" || detailSubTab === "penjualan") && (
                                <>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatRupiah(item.price)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">{formatRupiah(subtotal)}</td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary Card inside Modal */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Muatan</span>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedRecord.items.reduce((acc, it) => acc + it.loading, 0)} unit
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Terjual</span>
                    <p className="text-sm font-bold text-emerald-600">
                      {selectedRecord.items.reduce((acc, it) => acc + it.qty, 0)} unit
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sisa / Retur</span>
                    <p className="text-sm font-bold text-rose-600">
                      {selectedRecord.items.reduce((acc, it) => acc + it.retur, 0)} unit
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Omset</span>
                    <p className="text-base font-black text-indigo-700 font-mono">
                      {formatRupiah(selectedRecord.items.reduce((acc, it) => acc + (it.qty * it.price), 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const record = selectedRecord;
                    setSelectedRecord(null);
                    restoreHistoryRecord(record);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Form Transaksi</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Generate simple WhatsApp rekap text
                      const record = selectedRecord;
                      const isLoad = record.isLoadingRecord || record.tokoName === "LOADING_STOK";
                      const recordRevenue = record.items.reduce((acc, it) => acc + (it.qty * it.price), 0);
                      let waText = "";
                      
                      if (isLoad) {
                        waText = `*REKAP MUATAN BARANG (GUDANG)*\n`;
                        waText += `----------------------------------------\n`;
                        waText += `🆔 Kode Nota: ${getReceiptUniqueId("loading", record.salesName, record.tokoName, record.rawDate || record.date)}\n`;
                        waText += `👤 Sales: ${record.salesName}\n`;
                        waText += `📅 Tanggal: ${record.date}\n`;
                        waText += `----------------------------------------\n\n`;
                        waText += `*DAFTAR MUATAN:*\n`;
                        record.items.forEach(it => {
                          if (it.loading > 0) {
                            const sub = (it.loading || 0) * (it.price || 0);
                            waText += `📦 *${it.name}*\n`;
                            waText += `   🚚 Load: *${getBreakdownString(it.name, it.loading)}* (${it.loading} Pcs)\n`;
                            waText += `   💵 Harga: ${formatRupiah(it.price || 0)}\n`;
                            waText += `   💸 Sub: *${formatRupiah(sub)}*\n`;
                            waText += ` --------------------\n`;
                          }
                        });
                        const totalLoad = record.items.reduce((sum, it) => sum + (it.loading || 0), 0);
                        const totalVal = record.items.reduce((sum, it) => sum + ((it.loading || 0) * (it.price || 0)), 0);
                        waText += `\n▪️ *TOTAL MUATAN:* ${totalLoad} Pcs\n`;
                        waText += `▪️ *TOTAL NILAI:* ${formatRupiah(totalVal)}`;
                      } else {
                        waText = `*REKAP PENJUALAN TK PPJ*\n`;
                        waText += `----------------------------------------\n`;
                        waText += `🆔 Kode Nota: ${getReceiptUniqueId("penjualan", record.salesName, record.tokoName, record.rawDate || record.date)}\n`;
                        waText += `👤 Sales: ${record.salesName}\n`;
                        waText += `📅 Tanggal: ${record.date}\n`;
                        waText += `🏪 Toko: ${record.tokoName}\n`;
                        waText += `----------------------------------------\n\n`;
                        waText += `*DETAIL BARANG:*\n`;
                        record.items.forEach(it => {
                          if (it.loading > 0 || it.qty > 0 || it.retur > 0) {
                            waText += `- ${it.name} | Load: ${it.loading} | Jual: ${it.qty} | Retur: ${it.retur}\n`;
                          }
                        });
                        waText += `\n*TOTAL OMSET:* ${formatRupiah(recordRevenue)}`;
                      }
                      
                      navigator.clipboard.writeText(waText).then(() => {
                        showToast("✅ Teks rekap berhasil disalin! Membuka WhatsApp...");
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`, "_blank");
                      }).catch(err => {
                        console.warn("Clipboard writeText info:", err);
                        showToast("ℹ️ Membuka WhatsApp dengan rekap teks...");
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`, "_blank");
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim WA</span>
                  </button>
                  <button 
                    onClick={() => { setSelectedRecord(null); setDetailSubTab("semua"); }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer transition-all"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800 p-4 flex items-center gap-3"
          >
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toast.type === "success" ? "bg-emerald-500 animate-pulse" :
              toast.type === "warning" ? "bg-amber-500 animate-pulse" :
              "bg-rose-500 animate-pulse"
            }`} />
            <p className="text-xs md:text-sm font-bold tracking-wide leading-relaxed">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
