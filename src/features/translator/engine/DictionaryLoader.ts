import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { DictType } from './types';

interface DictionaryDB extends DBSchema {
  dictionaries: {
    key: string;
    value: {
      id: string; // dictType
      content: string;
      version: string;
      lastUpdated: number;
    };
  };
}

const DB_NAME = 'cv_translator_db';
const STORE_NAME = 'dictionaries';

export class DictionaryLoader {
  private dbPromise: Promise<IDBPDatabase<DictionaryDB>>;

  constructor() {
    this.dbPromise = openDB<DictionaryDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  async getCachedDictionary(type: DictType): Promise<string | null> {
    const db = await this.dbPromise;
    const entry = await db.get(STORE_NAME, type);
    return entry ? entry.content : null;
  }

  async saveDictionary(type: DictType, content: string, version: string = 'v1'): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, {
      id: type,
      content,
      version,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Fetches the dictionary from remote URL. 
   * If not available, uses fallback URL (e.g., local /public/dictionaries).
   */
  async fetchDictionaryFallback(url: string, fallbackUrl: string): Promise<string> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.text();
    } catch {
      console.warn(`Failed to fetch from ${url}, falling back to ${fallbackUrl}`);
      const res = await fetch(fallbackUrl);
      if (!res.ok) throw new Error(`Offline or fallback HTTP error ${res.status}`);
      return await res.text();
    }
  }

  async loadDictionary(
    type: DictType, 
    remoteUrl: string, 
    fallbackUrl: string, 
    forceRefresh: boolean = false
  ): Promise<string> {
    if (!forceRefresh) {
      const cached = await this.getCachedDictionary(type);
      if (cached) {
        return cached;
      }
    }

    // Fetch from network
    const content = await this.fetchDictionaryFallback(remoteUrl, fallbackUrl);
    
    // Save to cache without blocking
    this.saveDictionary(type, content).catch(err => {
      console.error(`Failed to cache dictionary ${type}`, err);
    });

    return content;
  }
}
