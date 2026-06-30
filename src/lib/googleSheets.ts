import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { TransactionItem } from "../types";
import { MASTER_PRODUCTS } from "../data";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider Setup
export const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Access token might not be immediately in cache, but we can retrieve it or wait for login
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we don't have cached token, user might need to sign in again to get fresh credentials
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress. Ignoring duplicate request.");
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal mendapatkan access token dari Google Auth.");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (
      errMsg.includes("popup-closed-by-user") ||
      errMsg.includes("popup-blocked") ||
      errMsg.includes("cancelled-popup-request")
    ) {
      console.warn("Sign in popup cancelled or blocked:", error);
    } else {
      console.error("Sign in error:", error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Logout
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Find spreadsheet "Rekap Penjualan TK PPJ" or create one
export const findOrCreateSpreadsheet = async (token: string, title: string = "Rekap Penjualan TK PPJ"): Promise<string> => {
  try {
    // 1. Search for existing spreadsheet file
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(title)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!searchRes.ok) {
      throw new Error(`Drive search failed with status ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      // Return existing sheet ID
      return searchData.files[0].id;
    }

    // 2. Not found, create new spreadsheet
    const createUrl = "https://sheets.googleapis.com/v4/spreadsheets";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: title
        }
      })
    });

    if (!createRes.ok) {
      throw new Error(`Sheets creation failed with status ${createRes.status}`);
    }

    const createdData = await createRes.json();
    return createdData.spreadsheetId;
  } catch (error) {
    console.error("findOrCreateSpreadsheet error:", error);
    throw error;
  }
};

// Ensure salesperson sheet and dashboard sheet exist and are formatted correctly
export const ensureSheetTabsAndHeaders = async (
  token: string,
  spreadsheetId: string,
  salesName: string
): Promise<void> => {
  try {
    // 1. Fetch spreadsheet to get existing sheets list
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Gagal mendapatkan rincian spreadsheet: ${res.status}`);
    }
    const spreadsheetData = await res.json();
    const existingSheets: { sheetId: number; title: string }[] = (spreadsheetData.sheets || []).map(
      (s: any) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title
      })
    );

    const hasDashboard = existingSheets.some(s => s.title === "REKAP UTAMA");
    const hasSalesTab = existingSheets.some(s => s.title === salesName);
    const defaultSheet = existingSheets.find(s => s.title === "Sheet1");

    const requests: any[] = [];
    let dashboardNeedsInit = false;
    let salesNeedsInit = false;

    // Handle DASHBOARD creation/rename
    if (!hasDashboard) {
      if (defaultSheet) {
        // Rename Sheet1 to REKAP UTAMA to avoid leaving unused Sheet1
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: defaultSheet.sheetId,
              title: "REKAP UTAMA"
            },
            fields: "title"
          }
        });
        dashboardNeedsInit = true;
      } else {
        // Create REKAP UTAMA
        requests.push({
          addSheet: {
            properties: {
              title: "REKAP UTAMA",
              index: 0
            }
          }
        });
        dashboardNeedsInit = true;
      }
    }

    // Handle Sales tab creation
    if (!hasSalesTab) {
      requests.push({
        addSheet: {
          properties: {
            title: salesName
          }
        }
      });
      salesNeedsInit = true;
    }

    // Send batch update if any changes needed
    if (requests.length > 0) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      });
      if (!batchRes.ok) {
        throw new Error(`Gagal membuat lembar kerja baru: ${batchRes.status}`);
      }
    }

    // Write dashboard headers and formulas if newly created/renamed
    if (dashboardNeedsInit) {
      const dashboardValues = [
        ["REKAP TOTAL OMSET PERSALES (POS TK PPJ)", "", ""],
        ["Tanggal & Waktu Real-Time", "Kategori", "Terakhir Sinkronisasi"],
        ["=NOW()", "Laporan Penjualan", "TK PPJ"],
        ["", "", ""],
        ["Nama Sales", "Total Omset (IDR)", "Status Keaktifan"],
        ["Rizky", "=IFERROR(SUM('Rizky'!I:I), 0)", `=IF(B6>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Iman", "=IFERROR(SUM('Iman'!I:I), 0)", `=IF(B7>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Deden", "=IFERROR(SUM('Deden'!I:I), 0)", `=IF(B8>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Cancan", "=IFERROR(SUM('Cancan'!I:I), 0)", `=IF(B9>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Martin", "=IFERROR(SUM('Martin'!I:I), 0)", `=IF(B10>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Fikri", "=IFERROR(SUM('Fikri'!I:I), 0)", `=IF(B11>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Sabani", "=IFERROR(SUM('Sabani'!I:I), 0)", `=IF(B12>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["Lukman", "=IFERROR(SUM('Lukman'!I:I), 0)", `=IF(B13>0, "🟢 Aktif", "⚪ Belum Ada Transaksi")`],
        ["TOTAL KESELURUHAN OMSET", "=SUM(B6:B13)", "Formula Otomatis"]
      ];

      const writeDashboardUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'REKAP UTAMA'!A1?valueInputOption=USER_ENTERED`;
      await fetch(writeDashboardUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: "'REKAP UTAMA'!A1",
          majorDimension: "ROWS",
          values: dashboardValues
        })
      });
    }

    // Write headers to the sales person tab if newly created
    if (salesNeedsInit) {
      const headers = [
        [
          "Tanggal & Waktu",
          "Nama Sales",
          "Nama Toko",
          "Nama Barang",
          "Loading (Stok)",
          "Terjual (Qty)",
          "Sisa (Retur)",
          "Harga Satuan",
          "Subtotal"
        ]
      ];
      const writeHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${salesName}'!A1?valueInputOption=USER_ENTERED`;
      await fetch(writeHeadersUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `'${salesName}'!A1`,
          majorDimension: "ROWS",
          values: headers
        })
      });
    }
  } catch (error) {
    console.error("ensureSheetTabsAndHeaders error:", error);
    throw error;
  }
};

// Append transaction items to the Google Sheet (under the salesperson's sheet)
export const appendTransactionToSheet = async (
  token: string,
  spreadsheetId: string,
  metadata: { salesName: string; tokoName: string; tanggal: string },
  items: TransactionItem[]
): Promise<void> => {
  try {
    // 1. Ensure appropriate sheets and dashboards exist with proper templates
    await ensureSheetTabsAndHeaders(token, spreadsheetId, metadata.salesName);

    // 2. Prepare transaction data rows
    const formattedRows = items
      .filter((item) => item.qty > 0 || item.loading > 0 || item.retur > 0)
      .map((item) => {
        const subtotal = item.qty * item.price;
        return [
          metadata.tanggal,
          metadata.salesName,
          metadata.tokoName,
          item.name,
          item.loading,
          item.qty,
          item.retur,
          item.price,
          subtotal
        ];
      });

    if (formattedRows.length === 0) return;

    // 3. Append to the salesperson's designated tab (e.g. 'Iman'!A1)
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(metadata.salesName)}'!A1:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range: `'${metadata.salesName}'!A1`,
        majorDimension: "ROWS",
        values: formattedRows
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to append rows to '${metadata.salesName}', status: ${res.status}`);
    }
  } catch (error) {
    console.error("appendTransactionToSheet error:", error);
    throw error;
  }
};
