import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SourceLink } from './SourceLink';

const openMock = vi.fn<(url: string) => Promise<void>>(async () => {});
vi.mock('@tauri-apps/plugin-shell', () => ({ open: (url: string) => openMock(url) }));
vi.mock('@/shared/utils/platform', () => ({ isTauri: () => true }));

describe('SourceLink', () => {
  beforeEach(() => openMock.mockClear());

  it('shows the source and opens the book there in the browser', async () => {
    render(<SourceLink book={{ chinese_link: 'https://fanqienovel.com/page/7582401378450951193', chinese_title: '反派：从夺舍仙子开始' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở trang nguồn trên Fanqie' }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith('https://fanqienovel.com/page/7582401378450951193'));
  });

  it('shows nothing for a story without a source link', () => {
    const { container } = render(<SourceLink book={{ chinese_link: '', chinese_title: '' }} />);
    expect(container.innerHTML).toBe('');
  });
});
