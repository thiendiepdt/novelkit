export type DictType = 'vietphrase' | 'name' | 'hanviet' | 'phienam';

export type TokenType = 'vietphrase' | 'name' | 'hanviet' | 'punctuation' | 'latin' | 'chinese_unmapped';

export interface TranslatedToken {
  original: string;
  translated: string;
  type: TokenType;
  dictType?: DictType;
  hasOneMeaning?: boolean;
}

export interface TranslationAlgorithmOptions {
  prioritizeName: boolean;
  algorithm: 'longest' | 'one_meaning' | 'first_match';
  target: 'vietphrase' | 'hanviet';
}
