import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

vi.mock('@/shared/components', () => ({ DownloadQueueManager: () => null, UploadQueueManager: () => null }));
vi.mock('@/features/settings/context/SettingsModalContext', () => ({ useSettingsModal: () => ({ openSettings: vi.fn() }) }));
vi.mock('@/features/ttc-uploader/revenue', () => ({ RevenueTicker: () => <div>ticker</div> }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );

describe('Header', () => {
  it('shows the revenue ticker on the TTC uploader only', () => {
    const { unmount } = renderAt('/ttc-uploader');
    expect(screen.getByText('ticker')).toBeTruthy();
    unmount();

    for (const path of ['/', '/text-formatter', '/downloads']) {
      const view = renderAt(path);
      expect(screen.queryByText('ticker')).toBeNull();
      view.unmount();
    }
  });
});
