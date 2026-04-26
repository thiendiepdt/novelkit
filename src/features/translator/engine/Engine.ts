import type { TranslatedToken, TranslationAlgorithmOptions } from './types';
import { DictionaryManager } from './DictionaryManager';

export class TranslatorEngine {
  private dictManager: DictionaryManager;
  private static CHINESE_LOOKUP_MAX_LENGTH = 20;

  constructor(dictManager: DictionaryManager) {
    this.dictManager = dictManager;
  }

  translate(
    text: string,
    options: TranslationAlgorithmOptions = { prioritizeName: true, algorithm: 'longest', target: 'vietphrase' }
  ): TranslatedToken[] {
    if (options.target === 'hanviet') {
      return this.translateHanViet(text);
    }
    
    const tokens: TranslatedToken[] = [];
    const len = text.length;
    let i = 0;

    while (i < len) {
      let matched = false;

      // Try matching longest phrase up to CHINESE_LOOKUP_MAX_LENGTH
      const maxJ = Math.min(TranslatorEngine.CHINESE_LOOKUP_MAX_LENGTH, len - i);
      
      for (let j = maxJ; j > 0; j--) {
        const phrase = text.substring(i, i + j);

        // 1. Check Name Dictionary (if prioritized or just found)
        if (this.dictManager.has('name', phrase)) {
          const translation = this.dictManager.get('name', phrase)!;
          tokens.push({
            original: phrase,
            translated: translation,
            type: 'name',
            dictType: 'name',
            hasOneMeaning: DictionaryManager.hasOnlyOneMeaning(translation),
          });
          i += j;
          matched = true;
          break;
        }

        // 2. Check VietPhrase Dictionary
        // TODO: Expand algorithm longest/one_meaning logic from original QT 
        // For now: first longest match wins
        if (this.dictManager.has('vietphrase', phrase)) {
          const translation = this.dictManager.get('vietphrase', phrase)!;
          tokens.push({
            original: phrase,
            translated: translation,
            type: 'vietphrase',
            dictType: 'vietphrase',
            hasOneMeaning: DictionaryManager.hasOnlyOneMeaning(translation),
          });
          i += j;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // No phrase match, handle single character
        const char = text[i];
        
        if (DictionaryManager.isChinese(char)) {
          let translated = char;
          let type: 'hanviet' | 'chinese_unmapped' = 'chinese_unmapped';

          if (this.dictManager.has('hanviet', char)) {
            translated = this.dictManager.get('hanviet', char)!;
            type = 'hanviet';
          }

          tokens.push({
            original: char,
            translated: translated,
            type: type,
            dictType: type === 'hanviet' ? 'hanviet' : undefined,
          });
        } else {
          // Wrap punctuation or latin chars
          const isPunctuation = /^[.,!?;:'"()[\]{}<>《》【】「」“”‘’\s]$/.test(char);
          tokens.push({
            original: char,
            translated: char,
            type: isPunctuation ? 'punctuation' : 'latin',
          });
        }
        
        i++;
      }
    }

    return this.postProcessTokens(tokens);
  }

  private translateHanViet(text: string): TranslatedToken[] {
    const tokens: TranslatedToken[] = [];
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const char = text[i];
      if (DictionaryManager.isChinese(char)) {
        let translated = char;
        let type: 'hanviet' | 'chinese_unmapped' = 'chinese_unmapped';

        if (this.dictManager.has('hanviet', char)) {
          translated = this.dictManager.get('hanviet', char)!;
          type = 'hanviet';
        }

        tokens.push({
          original: char,
          translated: translated,
          type: type,
          dictType: type === 'hanviet' ? 'hanviet' : undefined,
        });
      } else {
        const isPunctuation = /^[.,!?;:'"()[\]{}<>《》【】「」“”‘’\s]$/.test(char);
        tokens.push({
          original: char,
          translated: char,
          type: isPunctuation ? 'punctuation' : 'latin',
        });
      }
    }

    return this.postProcessTokens(tokens);
  }

  /**
   * Post-process:
   * Collapse adjacent latin/punctuation tokens to reduce DOM node counts
   */
  private postProcessTokens(tokens: TranslatedToken[]): TranslatedToken[] {
    const result: TranslatedToken[] = [];
    let currentTempToken: TranslatedToken | null = null;

    for (const token of tokens) {
      if (token.type === 'latin' || token.type === 'punctuation') {
        if (!currentTempToken) {
          currentTempToken = { ...token };
        } else {
          currentTempToken.original += token.original;
          currentTempToken.translated += token.translated;
        }
      } else {
        if (currentTempToken) {
          result.push(currentTempToken);
          currentTempToken = null;
        }
        result.push(token);
      }
    }

    if (currentTempToken) {
      result.push(currentTempToken);
    }

    return result;
  }
}
