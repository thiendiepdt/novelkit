/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { SettingsSidebar, type SettingsCategory } from './components/SettingsSidebar';
import { SettingsItem, SettingsToggle, SettingsNumber } from './components/SettingsItem';
import { useSettingsContext } from './context/SettingsContext';
import { useSettingsModal } from './context/SettingsModalContext';
import { Select, Tooltip } from '@/shared/components';
import { useTtcAuth } from '@/features/ttc-uploader/hooks/useTtcAuth';
import { useTtcBooks } from '@/features/ttc-uploader/hooks/useTtcBooks';
import { Settings, X, RotateCcw } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
  initialBookId?: number;
  initialBookTitle?: string;
}

/**
 * Settings panel — the core UI, reusable as a modal overlay or route page.
 */
export function SettingsPanel({ onClose, initialBookId, initialBookTitle }: SettingsPanelProps) {
  const { globalSettings, updateGlobalSettings, resetGlobalSettings, bookSettings, updateBookSettings, clearBookSettings } = useSettingsContext();
  
  const auth = useTtcAuth();
  const { books } = useTtcBooks(auth.session);

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('splitter');
  const [scope, setScope] = useState<string>(initialBookId ? initialBookId.toString() : 'global');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleScopeChange = (newScope: string) => {
    setScope(newScope);
  };

  const isGlobal = scope === 'global';
  const selectedBookId = isGlobal ? undefined : Number(scope);

  const getValue = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) {
      return (globalSettings as any)[section][key];
    } else {
      const bookVals = bookSettings[selectedBookId!]?.[section] as any;
      if (bookVals && bookVals[key] !== undefined) {
        return bookVals[key];
      }
      return (globalSettings as any)[section][key];
    }
  };

  const isOverridden = (section: 'splitter' | 'ttcUploader', key: string) => {
    if (isGlobal) return false;
    const bookVals = bookSettings[selectedBookId!]?.[section] as any;
    return bookVals && bookVals[key] !== undefined;
  };

  const setValue = (section: 'splitter' | 'ttcUploader', key: string, value: any) => {
    if (isGlobal) {
      updateGlobalSettings(section, { [key]: value } as any);
    } else {
      updateBookSettings(selectedBookId!, section, { [key]: value } as any);
    }
  };

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
        <Tooltip content="Giá trị này đang được ghi đè riêng cho truyện hiện tại. Bấm để xóa và dùng lại mặc định Global." side="top">
          <button
            onClick={() => clearOverride(section, key)}
            className="text-[10px] text-gold hover:text-crimson bg-gold/10 px-1.5 py-0.5 rounded ml-2 transition-colors cursor-pointer"
          >
            Đang Override (Reset)
          </button>
        </Tooltip>
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
              label={<span>Sắp xếp chương trong máy {renderOverrideIndicator('ttcUploader', 'localSortMode')}</span>}
              description="Thứ tự sắp xếp chương khi đọc folder: theo tên chương (Chương 1, 2, 3…) hoặc theo thứ tự file trong folder."
            >
              <Select
                value={getValue('ttcUploader', 'localSortMode')}
                onChange={(e) => setValue('ttcUploader', 'localSortMode', e.target.value)}
                className="py-1"
              >
                <option value="name" className="bg-bg-card text-text-primary">Tên chương</option>
                <option value="file" className="bg-bg-card text-text-primary">Thứ tự file</option>
              </Select>
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

            <SettingsItem 
              label={<span>Giá VIP chương (hoa) mặc định là 0 {renderOverrideIndicator('ttcUploader', 'chapterPrice')}</span>} 
              description="Số hoa mỗi chương VIP. Đặt 0 = miễn phí."
            >
              <SettingsNumber 
                value={getValue('ttcUploader', 'chapterPrice')} 
                onChange={v => setValue('ttcUploader', 'chapterPrice', v)} 
                min={0} step={1}
              />
            </SettingsItem>

            <SettingsItem 
              label={<span>Thời gian mở khóa VIP {renderOverrideIndicator('ttcUploader', 'unlockTimer')}</span>} 
              description="Sau thời gian này chương VIP sẽ tự mở khóa miễn phí. Để trống = không tự mở."
            >
              <Select
                value={getValue('ttcUploader', 'unlockTimer')}
                onChange={(e) => setValue('ttcUploader', 'unlockTimer', e.target.value)}
                className="py-1"
              >
                <option value="" className="bg-bg-card text-text-primary">Không tự mở</option>
                <option value="8h" className="bg-bg-card text-text-primary">8 giờ</option>
                <option value="1d" className="bg-bg-card text-text-primary">1 ngày</option>
                <option value="3d" className="bg-bg-card text-text-primary">3 ngày</option>
                <option value="7d" className="bg-bg-card text-text-primary">7 ngày</option>
              </Select>
            </SettingsItem>
            
            <SettingsItem 
              label={<span>Bỏ qua số chương đầu trên web {renderOverrideIndicator('ttcUploader', 'skipChapters')}</span>} 
              description="Số chương cũ muốn bỏ qua khi so sánh với web (chương trong máy đầu tiên sẽ khớp với chương N+1 trên web)."
            >
              <SettingsNumber 
                value={getValue('ttcUploader', 'skipChapters')} 
                onChange={v => setValue('ttcUploader', 'skipChapters', v)} 
                min={0} step={1}
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
                  label="Số chương hiển thị mỗi trang" 
                  description="Giới hạn số chương hiển thị trên mỗi trang của bảng danh sách chương."
                >
                  <SettingsNumber 
                    value={getValue('ttcUploader', 'chaptersLimit')} 
                    onChange={v => setValue('ttcUploader', 'chaptersLimit', v)} 
                    min={10} max={50} step={10}
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Settings Header Toolbar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border-main bg-bg-card flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Settings size={18} /> Settings
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
                  📖 {b.title}
                </option>
              ))}
              {initialBookId && initialBookTitle && !books.find(b => b.id === initialBookId) && (
                <option key={initialBookId} value={initialBookId.toString()} className="bg-bg-card text-text-primary font-normal">
                  📖 {initialBookTitle}
                </option>
              )}
            </optgroup>
          </Select>
        </div>

        {!isGlobal ? (
          <Tooltip content="Xóa toàn bộ cấu hình riêng của truyện này, dùng lại mặc định Global" side="bottom" className="ml-auto">
            <button
              onClick={() => clearBookSettings(selectedBookId!)}
              className="text-xs px-3 py-1.5 bg-crimson/10 text-crimson border border-crimson/30 rounded hover:bg-crimson/20 transition-colors cursor-pointer"
            >
              Xóa mọi Override của Truyện này
            </button>
          </Tooltip>
        ) : (
          <Tooltip content="Khôi phục toàn bộ cấu hình hệ thống về mặc định gốc" side="bottom" className="ml-auto">
            <button
              onClick={() => resetGlobalSettings()}
              className="text-xs px-3 py-1.5 bg-crimson/10 text-crimson border border-crimson/30 rounded hover:bg-crimson/20 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Khôi phục mặc định</span>
            </button>
          </Tooltip>
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

/**
 * Fullscreen overlay for the settings panel.
 * Rendered once in App.tsx — always mounted but only visible when isOpen.
 */
export function SettingsOverlay() {
  const { isOpen, bookId, bookTitle, closeSettings } = useSettingsModal();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] animate-fadeIn" style={{ background: '#121212' }}>
      <SettingsPanel onClose={closeSettings} initialBookId={bookId} initialBookTitle={bookTitle} />
    </div>
  );
}
