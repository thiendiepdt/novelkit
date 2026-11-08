import type { FolderSyncStatus } from '../utils/folderSync';

/** How the folder of a story differs from TTC, on its card in the "Chưa đồng bộ" tab. */
export function FolderSyncNote({ status }: { status: FolderSyncStatus | undefined }) {
  if (!status || status.kind === 'synced') return null;
  if (status.kind === 'ahead') {
    return (
      <span className="text-gold font-medium">
        Folder có {status.localCount} chương, TTC {status.remoteCount}: {status.localCount - status.remoteCount} chương chưa đăng
      </span>
    );
  }
  if (status.kind === 'changed') {
    return (
      <span className="block truncate text-crimson/90" title={`Folder: ${status.local}\nTTC: ${status.remote}`}>
        Chương {status.chapter} khác TTC · Folder: “{status.local}” · TTC: “{status.remote}”
      </span>
    );
  }
  return <span className="text-crimson/90">{status.reason}</span>;
}
