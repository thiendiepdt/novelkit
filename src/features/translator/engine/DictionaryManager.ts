import type { DictType } from './types';
import { isChinese } from '@/shared/utils/regex';

export class DictionaryManager {
  private dictionaries: Record<DictType, Map<string, string>> = {
    vietphrase: new Map(),
    name: new Map(),
    hanviet: new Map(),
    phienam: new Map(),
  };

  static isChinese(char: string): boolean {
    return isChinese(char);
  }

  static hasOnlyOneMeaning(translation: string): boolean {
    return !translation.includes('/') && !translation.includes('|');
  }

  static getFirstMeaning(translation: string): string {
    return translation.split(/[/|]/)[0];
  }

  loadDictionary(type: DictType, text: string) {
    const map = this.dictionaries[type];
    map.clear();
    
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const equalsIdx = line.indexOf('=');
      if (equalsIdx > 0) {
        const key = line.substring(0, equalsIdx).trim();
        const info = line.substring(equalsIdx + 1).trim();
        map.set(key, info);
      }
    }
  }

  get(type: DictType, key: string): string | undefined {
    return this.dictionaries[type].get(key);
  }

  has(type: DictType, key: string): boolean {
    return this.dictionaries[type].has(key);
  }

  addOrUpdate(type: DictType, key: string, value: string) {
    this.dictionaries[type].set(key, value);
  }

  delete(type: DictType, key: string) {
    this.dictionaries[type].delete(key);
  }
}
