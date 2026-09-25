"use client";

/**
 * Where this device keeps its private key: IndexedDB, as a NON-extractable CryptoKey (scripts on the page
 * can use it but never read it back out). If IndexedDB is unavailable (some private windows) the key lives
 * in memory for the session and the passphrase restores it next time.
 */
export type LocalIdentity = { privateKey: CryptoKey; publicKey: string };

const DB_NAME = "allyza-e2ee";
const STORE = "keys";
const memory = new Map<string, LocalIdentity>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

export async function loadIdentity(userId: string): Promise<LocalIdentity | null> {
  try {
    return ((await run("readonly", (s) => s.get(`identity:${userId}`))) as LocalIdentity | undefined) ?? memory.get(userId) ?? null;
  } catch {
    return memory.get(userId) ?? null;
  }
}

export async function saveIdentity(userId: string, identity: LocalIdentity): Promise<void> {
  memory.set(userId, identity);
  try { await run("readwrite", (s) => s.put(identity, `identity:${userId}`)); } catch { /* memory only */ }
}

export async function clearIdentity(userId: string): Promise<void> {
  memory.delete(userId);
  try { await run("readwrite", (s) => s.delete(`identity:${userId}`)); } catch { /* nothing stored */ }
}

/** The other person's key as first seen (trust on first use): a later change is surfaced, never silent. */
const pinKey = (partnerId: string) => `allyza.e2ee.pin.${partnerId}`;
export const readPinned = (partnerId: string): string | null => { try { return localStorage.getItem(pinKey(partnerId)); } catch { return null; } };
export const writePinned = (partnerId: string, fingerprint: string) => { try { localStorage.setItem(pinKey(partnerId), fingerprint); } catch { /* private mode */ } };
