import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const tauri = { value: true };
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock('@/shared/utils/platform', () => ({ isTauri: () => tauri.value }));

import { reportWebviewUserAgent } from './userAgent';

describe('reportWebviewUserAgent', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    tauri.value = true;
  });

  it('sends navigator.userAgent to the Rust side', async () => {
    invokeMock.mockResolvedValue(navigator.userAgent);
    await reportWebviewUserAgent();
    expect(invokeMock).toHaveBeenCalledWith('ttc_set_user_agent', { userAgent: navigator.userAgent });
  });

  it('does nothing on the web', async () => {
    tauri.value = false;
    await reportWebviewUserAgent();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('never blocks startup on a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    invokeMock.mockRejectedValue('command not found');
    await expect(reportWebviewUserAgent()).resolves.toBeUndefined();
    error.mockRestore();
  });
});
