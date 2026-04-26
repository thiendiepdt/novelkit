import * as Comlink from 'comlink';
import { DictionaryManager } from './DictionaryManager';
import { TranslatorEngine } from './Engine';
import { DictionaryLoader } from './DictionaryLoader';
import type { DictType, TranslatedToken, TranslationAlgorithmOptions } from './types';

export class TranslatorWorkerAPI {
  private dictManager: DictionaryManager;
  private engine: TranslatorEngine;
  private loader: DictionaryLoader;

  private isReady = false;

  constructor() {
    this.dictManager = new DictionaryManager();
    this.engine = new TranslatorEngine(this.dictManager);
    this.loader = new DictionaryLoader();
  }

  async init(remoteBaseUrl: string = '', fallbackBaseUrl: string = '/dictionaries'): Promise<void> {
    const dictTypes: DictType[] = ['vietphrase', 'name', 'hanviet'];
    
    // Concurrently load dictionaries
    await Promise.all(
      dictTypes.map(async (type) => {
        let fileName = '';
        if (type === 'vietphrase') fileName = 'VietPhrase.txt';
        if (type === 'name') fileName = 'Names.txt';
        if (type === 'hanviet') fileName = 'HanViet.txt';

        const remoteUrl = remoteBaseUrl ? `${remoteBaseUrl}/${fileName}` : `${fallbackBaseUrl}/${fileName}`;
        const fallbackUrl = `${fallbackBaseUrl}/${fileName}`;

        try {
          const content = await this.loader.loadDictionary(type, remoteUrl, fallbackUrl);
          this.dictManager.loadDictionary(type, content);
        } catch (e) {
          console.error(`Failed to load dictionary: ${type}`, e);
        }
      })
    );

    this.isReady = true;
  }

  checkReady(): boolean {
    return this.isReady;
  }

  translate(text: string, options?: TranslationAlgorithmOptions): TranslatedToken[] {
    if (!this.isReady) {
      throw new Error("Translator Engine is not ready yet. Please wait for init.");
    }
    return this.engine.translate(text, options);
  }

  updateDictionary(type: DictType, key: string, value: string) {
    this.dictManager.addOrUpdate(type, key, value);
    // Ideally we should sync this to IndexedDB, but for simplicity we only update in memory for now.
    // If we want persistent updates, we'd need to fetch the full text from IDB, append, and save.
  }
}
const workerApi = new TranslatorWorkerAPI();
Comlink.expose(workerApi);
