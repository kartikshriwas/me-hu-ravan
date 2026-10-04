export interface OfflineVideoMetadata {
  videoId: string;
  courseSlug: string;
  courseTitle: string;
  sectionTitle?: string;
  sectionId?: string;
  unitTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
  quality: string;
  sizeBytes: number;
  downloadedAt: number;
  mimeType: string;
}

export interface OfflineVideoRecord extends OfflineVideoMetadata {
  blob: Blob;
}

const DB_NAME = 'PrepTeaVideoVault';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error('IndexedDB is not supported on this browser/device.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        store.createIndex('courseSlug', 'courseSlug', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB database.'));
  });
}

/**
 * Save or update a downloaded video in local IndexedDB.
 */
export async function saveDownloadedVideo(record: OfflineVideoRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save downloaded video'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Check if a specific video is downloaded.
 */
export async function isVideoDownloaded(videoId: string): Promise<boolean> {
  if (!videoId || !isIndexedDBSupported()) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count(IDBKeyRange.only(videoId));

      request.onsuccess = () => {
        resolve(request.result > 0);
      };
      request.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return false;
  }
}

/**
 * Get full video record (including Blob) by videoId.
 */
export async function getDownloadedVideoRecord(videoId: string): Promise<OfflineVideoRecord | null> {
  if (!videoId || !isIndexedDBSupported()) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(videoId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get just the video Blob by videoId for instant playback.
 */
export async function getDownloadedVideoBlob(videoId: string): Promise<Blob | null> {
  const record = await getDownloadedVideoRecord(videoId);
  return record?.blob || null;
}

/**
 * Get all downloaded videos' metadata (without holding blobs in memory).
 */
export async function getAllDownloadedVideos(): Promise<OfflineVideoMetadata[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items: OfflineVideoRecord[] = request.result || [];
      // Strip blobs to prevent memory overhead in listing components
      const metaList: OfflineVideoMetadata[] = items
        .map(({ blob, ...meta }) => meta)
        .sort((a, b) => b.downloadedAt - a.downloadedAt);
      resolve(metaList);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Delete a downloaded video by videoId.
 */
export async function deleteDownloadedVideo(videoId: string): Promise<void> {
  if (!videoId || !isIndexedDBSupported()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(videoId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete all downloaded videos belonging to a course.
 */
export async function deleteCourseDownloadedVideos(courseSlug: string): Promise<void> {
  if (!courseSlug || !isIndexedDBSupported()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('courseSlug');
    const request = index.openCursor(IDBKeyRange.only(courseSlug));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete all downloaded videos belonging to a specific section of a course.
 */
export async function deleteSectionDownloadedVideos(
  courseSlug: string,
  sectionTitle: string
): Promise<void> {
  if (!courseSlug || !sectionTitle || !isIndexedDBSupported()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('courseSlug');
    const request = index.openCursor(IDBKeyRange.only(courseSlug));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const record = cursor.value as OfflineVideoMetadata;
        if (record.sectionTitle === sectionTitle) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all downloaded videos from IndexedDB.
 */
export async function clearAllDownloadedVideos(): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get offline storage usage and browser quota estimation.
 */
export async function getOfflineStorageUsage(): Promise<{
  usedBytes: number;
  count: number;
  quotaBytes?: number;
  quotaUsedBytes?: number;
}> {
  const videos = await getAllDownloadedVideos();
  const usedBytes = videos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);

  let quotaBytes: number | undefined;
  let quotaUsedBytes: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota;
      quotaUsedBytes = estimate.usage;
    } catch {
      // Ignore quota estimation failure
    }
  }

  return {
    usedBytes,
    count: videos.length,
    quotaBytes,
    quotaUsedBytes,
  };
}
