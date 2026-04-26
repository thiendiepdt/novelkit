import React from 'react';

export type SettingsCategory = 'general' | 'splitter' | 'ttcUploader';

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onSelectCategory: (cat: SettingsCategory) => void;
}

const CATEGORIES: { id: SettingsCategory; label: string; icon: string }[] = [
  { id: 'general', label: 'Chung (General)', icon: '⚙️' },
  { id: 'splitter', label: 'Chapter Splitter', icon: '✂️' },
  { id: 'ttcUploader', label: 'TTC Uploader', icon: '🚀' },
];

export function SettingsSidebar({ activeCategory, onSelectCategory }: SettingsSidebarProps) {
  return (
    <div className="w-full md:w-64 flex-shrink-0 border-r border-border-main p-4 flex flex-col gap-1 overflow-y-auto">
      <h2 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3 px-3">
        Cài Đặt
      </h2>
      {CATEGORIES.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-3 ${
            activeCategory === cat.id
              ? 'bg-gold/10 text-gold font-medium border border-gold/30'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
          }`}
        >
          <span>{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}


