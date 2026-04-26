import { describe, it, expect } from 'vitest';
import { DictionaryManager } from './DictionaryManager';
import { TranslatorEngine } from './Engine';

describe('DictionaryManager', () => {
  it('should load dictionary entries from text', () => {
    const dm = new DictionaryManager();
    dm.loadDictionary('vietphrase', '你好=Xin chào\n世界=Thế giới');
    expect(dm.has('vietphrase', '你好')).toBe(true);
    expect(dm.get('vietphrase', '你好')).toBe('Xin chào');
    expect(dm.get('vietphrase', '世界')).toBe('Thế giới');
  });

  it('should skip empty lines in dictionary', () => {
    const dm = new DictionaryManager();
    dm.loadDictionary('name', '\n\nFoo=Bar\n\n');
    expect(dm.has('name', 'Foo')).toBe(true);
    expect(dm.get('name', 'Foo')).toBe('Bar');
  });

  it('should clear previous entries on reload', () => {
    const dm = new DictionaryManager();
    dm.loadDictionary('hanviet', '你=nhĩ');
    expect(dm.has('hanviet', '你')).toBe(true);
    dm.loadDictionary('hanviet', '好=hảo');
    expect(dm.has('hanviet', '你')).toBe(false);
    expect(dm.has('hanviet', '好')).toBe(true);
  });

  it('should detect Chinese characters', () => {
    expect(DictionaryManager.isChinese('你')).toBe(true);
    expect(DictionaryManager.isChinese('A')).toBe(false);
    expect(DictionaryManager.isChinese('1')).toBe(false);
  });

  it('should detect single vs multi-meaning translations', () => {
    expect(DictionaryManager.hasOnlyOneMeaning('xin chào')).toBe(true);
    expect(DictionaryManager.hasOnlyOneMeaning('hello/xin chào')).toBe(false);
    expect(DictionaryManager.hasOnlyOneMeaning('a|b')).toBe(false);
  });

  it('should get first meaning from multi-meaning', () => {
    expect(DictionaryManager.getFirstMeaning('hello/xin chào')).toBe('hello');
    expect(DictionaryManager.getFirstMeaning('a|b|c')).toBe('a');
    expect(DictionaryManager.getFirstMeaning('only')).toBe('only');
  });

  it('should add and update entries', () => {
    const dm = new DictionaryManager();
    dm.addOrUpdate('vietphrase', '测试', 'Kiểm tra');
    expect(dm.get('vietphrase', '测试')).toBe('Kiểm tra');
    dm.addOrUpdate('vietphrase', '测试', 'Thử nghiệm');
    expect(dm.get('vietphrase', '测试')).toBe('Thử nghiệm');
  });

  it('should delete entries', () => {
    const dm = new DictionaryManager();
    dm.addOrUpdate('name', '张三', 'Trương Tam');
    expect(dm.has('name', '张三')).toBe(true);
    dm.delete('name', '张三');
    expect(dm.has('name', '张三')).toBe(false);
  });
});

describe('TranslatorEngine', () => {
  function createEngine() {
    const dm = new DictionaryManager();
    dm.loadDictionary('vietphrase', '你好=Xin chào\n世界=Thế giới\n大家=mọi người');
    dm.loadDictionary('name', '张三=Trương Tam');
    dm.loadDictionary('hanviet', '你=nhĩ\n好=hảo\n世=thế\n界=giới');
    return new TranslatorEngine(dm);
  }

  it('should translate VietPhrase tokens via longest match', () => {
    const engine = createEngine();
    const tokens = engine.translate('你好世界');
    const translated = tokens.map(t => t.translated).join('');
    expect(translated).toContain('Xin chào');
    expect(translated).toContain('Thế giới');
  });

  it('should prioritize Name dictionary', () => {
    const engine = createEngine();
    const tokens = engine.translate('张三');
    const nameToken = tokens.find(t => t.type === 'name');
    expect(nameToken).toBeDefined();
    expect(nameToken?.translated).toBe('Trương Tam');
  });

  it('should fall back to HanViet for unmapped single chars', () => {
    // Use a clean engine with only hanviet dictionary
    const dm = new DictionaryManager();
    dm.loadDictionary('vietphrase', '');
    dm.loadDictionary('name', '');
    dm.loadDictionary('hanviet', '你=nhĩ');
    const engine2 = new TranslatorEngine(dm);
    const tokens = engine2.translate('你');
    expect(tokens[0].type).toBe('hanviet');
    expect(tokens[0].translated).toBe('nhĩ');
  });

  it('should mark unmapped Chinese chars as chinese_unmapped', () => {
    const dm = new DictionaryManager();
    dm.loadDictionary('vietphrase', '');
    dm.loadDictionary('name', '');
    dm.loadDictionary('hanviet', '');
    const engine = new TranslatorEngine(dm);
    const tokens = engine.translate('龘');
    expect(tokens[0].type).toBe('chinese_unmapped');
  });

  it('should handle Latin text as passthrough', () => {
    const engine = createEngine();
    const tokens = engine.translate('Hello');
    // Latin characters should be collapsed into one token
    expect(tokens.length).toBe(1);
    expect(tokens[0].translated).toBe('Hello');
  });

  it('should handle mixed Chinese and Latin', () => {
    const engine = createEngine();
    const tokens = engine.translate('Hello你好World');
    const types = tokens.map(t => t.type);
    expect(types).toContain('latin');
    expect(types).toContain('vietphrase');
  });

  it('should translate in HanViet mode (char-by-char)', () => {
    const engine = createEngine();
    const tokens = engine.translate('你好', {
      prioritizeName: true,
      algorithm: 'longest',
      target: 'hanviet',
    });
    expect(tokens[0].translated).toBe('nhĩ');
    expect(tokens[1].translated).toBe('hảo');
  });

  it('should collapse adjacent punctuation and latin tokens', () => {
    const engine = createEngine();
    const tokens = engine.translate('ABC 123');
    // Should be collapsed into fewer tokens than 7 individual chars
    expect(tokens.length).toBeLessThanOrEqual(2);
  });

  it('should handle empty input', () => {
    const engine = createEngine();
    const tokens = engine.translate('');
    expect(tokens).toHaveLength(0);
  });
});
