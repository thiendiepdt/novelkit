/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingsSidebar, type SettingsCategory } from './components/SettingsSidebar';
import { SettingsItem, SettingsToggle, SettingsNumber } from './components/SettingsItem';
import { useSettingsContext } from './context/SettingsContext';
import { Select } from '@/shared/components';
import { useTtcBooks } from '@/features/ttc-uploader/hooks/useTtcBooks'; // To get book names for the dropdown

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { globalSettings, updateGlobalSettings, resetGlobalSettings, bookSettings, updateBookSettings, clearBookSettings } = useSettingsContext();
  
  // Try to load books so we can show names in the dropdown
  const { books } = useTtcBooks();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('splitter');
  
  // "global" or specific book ID
  const rawBookId = searchParams.get('bookId');
  const scope = rawBookId || 'global';

  const handleScopeChange = (newScope: string) => {
    if (newScope === 'global') {
      searchParams.delete('bookId');
    } else {
      searchParams.set('bookId', newScope);
    }
    setSearchParams(searchParams);
  };

  const isGlobal = scope === 'global';
  const selectedBookId = isGlobal ? undefined : Number(scope);

  // Helper to read current value based on scope
  const getValue = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) {
      return (globalSettings as any)[section][key];
    } else {
      // Fallback to global if per-book is not set
      const bookVals = bookSettings[selectedBookId!]?.[section] as any;
      if (bookVals && bookVals[key] !== undefined) {
        return bookVals[key];
      }
      return (globalSettings as any)[section][key];
    }
  };

  // Helper to check if a value is overridden
  const isOverridden = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) return false;
    const bookVals = bookSettings[selectedBookId!]?.[section] as any;
    return bookVals && bookVals[key] !== undefined;
  };

  // Helper to write value
  const setValue = (section: 'splitter' | 'ttcUploader', key: string, value: any) => {
    if (isGlobal) {
      updateGlobalSettings(section, { [key]: value } as any);
    } else {
      updateBookSettings(selectedBookId!, section, { [key]: value } as any);
    }
  };

  // Helper to clear an override
  const clearOverride = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) return;
    const currentSectionOverrides = bookSettings[selectedBookId!]?.[section] as any || {};
    const newOverrides = { ...currentSectionOverrides };
    delete newOverrides[key];
    updateBookSettings(selectedBookId!, section, newOverrides);
  };

  const renderOverrideIndicator = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) return null;
    if (isOverridden(section, key)) {
      return (
        <button 
          onClick={() => clearOverride(section, key)}
          className="text-[10px] text-gold hover:text-crimson bg-gold/10 px-1.5 py-0.5 rounded ml-2 transition-colors cursor-pointer"
          title="Xóa cấu hình riêng, dùng lại mặc định Global"
        >
          Đang Override (Reset)
        </button>
      );
    }
    return null;
  };

  const renderContent = () => {
    switch (activeCategory) {
      case 'splitter':
        return (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium text-text-primary mb-2 border-b border-border-main pb-2">Chapter Splitter</h3>
            
            <SettingsItem 
              label={<span>Giới hạn số chữ tối đa {renderOverrideIndicator('splitter', 'maxWords')}</span>} 
              description="Số chữ tối đa mỗi chương con. Nếu vượt quá sẽ tự động chia nhỏ."
            >
              <SettingsNumber 
                value={getValue('splitter', 'maxWords')} 
                onChange={v => setValue('splitter', 'maxWords', v)} 
                min={100} step={100}
              />
            </SettingsItem>

            <SettingsItem 
              label={<span>Giới hạn chữ tối thiểu (Gộp) {renderOverrideIndicator('splitter', 'minWords')}</span>} 
              description="Nếu chương con cuối cùng có số chữ ít hơn mức này, nó sẽ bị gộp ngược vào chương con ngay trước đó."
            >
              <SettingsNumber 
                value={getValue('splitter', 'minWords')} 
                onChange={v => setValue('splitter', 'minWords', v)} 
                min={0} step={100}
              />
            </SettingsItem>

            <SettingsItem 
              label={<span>Chế độ làm tròn lên (Round Up) {renderOverrideIndicator('splitter', 'roundUp')}</span>} 
              description="Nếu bật, chương con sẽ cố gắng chứa đoạn văn cuối cùng kể cả khi hơi lố maxWords. Nếu tắt, nó sẽ ngắt trước khi vượt maxWords."
            >
              <SettingsToggle 
                checked={getValue('splitter', 'roundUp')} 
                onChange={v => setValue('splitter', 'roundUp', v)} 
              />
            </SettingsItem>
          </div>
        );
      
      case 'ttcUploader':
        return (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium text-text-primary mb-2 border-b border-border-main pb-2">TTC Uploader</h3>
            
            <SettingsItem 
              label={<span>Tự động chia chương khi Upload {renderOverrideIndicator('ttcUploader', 'enableSplit')}</span>} 
              description="Bật tính năng tự động chạy nội dung qua Chapter Splitter trước khi so sánh/đẩy lên TTC."
            >
              <SettingsToggle 
                checked={getValue('ttcUploader', 'enableSplit')} 
                onChange={v => setValue('ttcUploader', 'enableSplit', v)} 
              />
            </SettingsItem>

            <SettingsItem 
              label={<span>Delay giữa các requests (ms) {renderOverrideIndicator('ttcUploader', 'uploadDelayMs')}</span>} 
              description="Thời gian chờ giữa các lần push API để tránh bị rate-limit 429 từ TTC."
            >
              <SettingsNumber 
                value={getValue('ttcUploader', 'uploadDelayMs')} 
                onChange={v => setValue('ttcUploader', 'uploadDelayMs', v)} 
                min={100} step={100}
              />
            </SettingsItem>
            
            {isGlobal && (
              <>
                <SettingsItem 
                  label="Số lượng truyện tối đa tải về (Limit)" 
                  description="Giới hạn số sách hiển thị trên tab TTC Uploader."
                >
                  <SettingsNumber 
                    value={getValue('ttcUploader', 'booksLimit')} 
                    onChange={v => setValue('ttcUploader', 'booksLimit', v)} 
                    min={10} step={10}
                  />
                </SettingsItem>

                <SettingsItem 
                  label="Số lượng chương tối đa tải về (Limit)" 
                  description="Giới hạn số chương mỗi lần request. (TTC hỗ trợ tối đa 1000)."
                >
                  <SettingsNumber 
                    value={getValue('ttcUploader', 'chaptersLimit')} 
                    onChange={v => setValue('ttcUploader', 'chaptersLimit', v)} 
                    min={100} max={1000} step={100}
                  />
                </SettingsItem>
              </>
            )}
          </div>
        );
      
      case 'general':
      default:
        return (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium text-text-primary mb-2 border-b border-border-main pb-2">Chung</h3>
            <div className="p-4 bg-bg-hover/50 rounded-xl border border-border-main text-sm text-text-secondary text-center">
              Các cấu hình chung của hệ thống sẽ được bổ sung tại đây trong tương lai.
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden animate-fadeIn">
      {/* Settings Header Toolbar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border-main bg-bg-card flex items-center gap-4">
        <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span>⚙️</span> Settings
        </h1>
        
        <div className="h-6 w-px bg-border-main mx-2" />

        {/* Scope Selector */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-dim">Phạm vi:</span>
          <Select
            value={scope}
            onChange={(e) => handleScopeChange(e.target.value)}
            className="py-1"
          >
            <option value="global" className="bg-bg-card text-text-primary">🌍 Mặc định (Global)</option>
            <optgroup label="Tùy chỉnh riêng cho Truyện (Per-Book)" className="bg-bg-hover text-text-dim font-bold">
              {books.map(b => (
                <option key={b.id} value={b.id.toString()} className="bg-bg-card text-text-primary font-normal">
                  📖 {b.name}
                </option>
              ))}
              {/* If accessed via URL with a book not in current page list */}
              {rawBookId && !books.find(b => b.id.toString() === rawBookId) && (
                <option value={rawBookId} className="bg-bg-card text-text-primary font-normal">📖 Truyện ID {rawBookId}</option>
              )}
            </optgroup>
          </Select>
        </div>

        {!isGlobal ? (
          <button
            onClick={() => clearBookSettings(selectedBookId!)}
            className="ml-auto text-xs px-3 py-1.5 bg-crimson/10 text-crimson border border-crimson/30 rounded hover:bg-crimson/20 transition-colors cursor-pointer"
          >
            Xóa mọi Override của Truyện này
          </button>
        ) : (
          <button
            onClick={() => resetGlobalSettings()}
            className="ml-auto text-xs px-3 py-1.5 bg-crimson/10 text-crimson border border-crimson/30 rounded hover:bg-crimson/20 transition-colors cursor-pointer flex items-center gap-1"
            title="Khôi phục toàn bộ cấu hình hệ thống về mặc định gốc"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span className="hidden sm:inline">Khôi phục mặc định</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SettingsSidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-bg-primary">
          <div className="max-w-3xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}


