import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { HistoryRecord } from "../types";

// Config parsed from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyD3cDiAy2STbPi33jNp1Q1tdhS50LfM90E",
  authDomain: "gen-lang-client-0275262544.firebaseapp.com",
  projectId: "gen-lang-client-0275262544",
  storageBucket: "gen-lang-client-0275262544.firebasestorage.app",
  messagingSenderId: "409655302406",
  appId: "1:409655302406:web:ec263b1d357ac2310e2687"
};

const databaseId = "ai-studio-printfixer-4a3d7e63-ddbf-4816-adb7-4c36e1188e28";

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, databaseId);

// Collection Names
export const HISTORY_COLLECTION = "historyRecords";
export const SETTINGS_COLLECTION = "settings";

// 1. Sync History Records from Firestore
export function subscribeToHistory(onUpdate: (records: HistoryRecord[]) => void) {
  return onSnapshot(collection(db, HISTORY_COLLECTION), (snapshot) => {
    const records: HistoryRecord[] = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as HistoryRecord);
    });
    // Sort by rawDate or date descending so newest are on top
    records.sort((a, b) => {
      const dateA = a.rawDate || a.date;
      const dateB = b.rawDate || b.date;
      return dateB.localeCompare(dateA);
    });
    onUpdate(records);
  }, (error) => {
    console.error("Firestore Subscribe History Error:", error);
  });
}

// 2. Save or Update History Record in Firestore
export async function saveHistoryToFirestore(record: HistoryRecord) {
  try {
    const docRef = doc(db, HISTORY_COLLECTION, record.id);
    await setDoc(docRef, {
      ...record,
      createdAt: new Date().toISOString()
    });
    console.log("History record saved to Firestore successfully:", record.id);
  } catch (error) {
    console.error("Error saving history record to Firestore:", error);
    throw error;
  }
}

// 3. Delete History Record from Firestore
export async function deleteHistoryFromFirestore(recordId: string) {
  try {
    const docRef = doc(db, HISTORY_COLLECTION, recordId);
    await deleteDoc(docRef);
    console.log("History record deleted from Firestore successfully:", recordId);
  } catch (error) {
    console.error("Error deleting history record from Firestore:", error);
    throw error;
  }
}

// 4. Sync Sales People from Firestore
export function subscribeToSalesPeople(onUpdate: (sales: string[]) => void, defaultSales: string[]) {
  const docRef = doc(db, SETTINGS_COLLECTION, "sales");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.list)) {
        onUpdate(data.list);
        return;
      }
    }
    // If setting doesn't exist yet, we initialize it
    onUpdate(defaultSales);
  }, (error) => {
    console.error("Firestore Subscribe Sales Error:", error);
  });
}

// 5. Update Sales People in Firestore
export async function updateSalesPeopleInFirestore(salesList: string[]) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "sales");
    await setDoc(docRef, { list: salesList });
    console.log("Sales people list updated in Firestore");
  } catch (error) {
    console.error("Error updating sales people list in Firestore:", error);
    throw error;
  }
}

// 6. Sync Products list from Firestore
export function subscribeToProducts(onUpdate: (products: any[]) => void, defaultProducts: any[]) {
  const docRef = doc(db, SETTINGS_COLLECTION, "products");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        onUpdate(data.list);
        return;
      }
    }
    onUpdate(defaultProducts);
  }, (error) => {
    console.error("Firestore Subscribe Products Error:", error);
  });
}

// 7. Update Products list in Firestore
export async function updateProductsInFirestore(productsList: any[]) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "products");
    await setDoc(docRef, { list: productsList });
    console.log("Products list updated in Firestore");
  } catch (error) {
    console.error("Error updating products list in Firestore:", error);
    throw error;
  }
}
