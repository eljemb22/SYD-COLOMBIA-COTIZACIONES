/**
 * High-Performance IndexedDB Storage Engine for Large Documents & Manuals
 *
 * Designed to handle heavy biomedical files (such as 500-page service manuals,
 * INVIMA regulatory records, and high-resolution technical sheets) without
 * hitting localStorage's 5MB quota limit or freezing React render cycles.
 */

const DB_NAME = 'syd_biomedical_docs_v1';
const STORE_NAME = 'binary_files';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Converts a base64 Data URI to a native Blob for minimal memory footprint
 */
export function dataURItoBlob(dataURI: string): Blob {
  if (!dataURI.startsWith('data:')) {
    return new Blob([dataURI], { type: 'application/octet-stream' });
  }

  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeString });
}

/**
 * Stores heavy file binary data in IndexedDB
 */
export async function saveFileToIndexedDB(
  id: string,
  dataUrl: string,
  meta?: { fileName?: string; fileSize?: string; mimeType?: string }
): Promise<void> {
  try {
    const db = await getDB();
    const blob = dataURItoBlob(dataUrl);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id,
        blob,
        dataUrl: dataUrl.length < 500000 ? dataUrl : undefined, // Keep dataUrl in cache only if <500KB
        fileName: meta?.fileName,
        fileSize: meta?.fileSize,
        mimeType: blob.type || meta?.mimeType || 'application/pdf',
        updatedAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not save to IndexedDB, fallback to memory:', err);
  }
}

/**
 * Retrieves file from IndexedDB as a Blob URL (efficient streaming)
 */
export async function getFileBlobUrlFromIndexedDB(id: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (result.blob instanceof Blob) {
          const url = URL.createObjectURL(result.blob);
          resolve(url);
        } else if (result.dataUrl) {
          const blob = dataURItoBlob(result.dataUrl);
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
    return null;
  }
}

/**
 * Deletes a file from IndexedDB
 */
export async function deleteFileFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error deleting from IndexedDB:', err);
  }
}
