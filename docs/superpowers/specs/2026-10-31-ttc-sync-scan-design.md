# "Quét chương mới": find stories whose folder is ahead of TTC

Date: 2026-10-31. Approved by the owner in chat ("OK, làm đi": new chapters preselected,
changed stories listed and selectable as an overwrite from the first difference).

## Goal

One screen, like "Check vô hố", that tells which stories have chapters in their local folder
that TTC does not have yet, or chapters that differ from TTC, and queues the uploads in one go.

## Scope of a scan

- Every story of the active account (statuses `ongoing,full,paused`) whose per-book settings
  have a folder. Stories without a folder are only counted ("N truyện chưa chọn folder").
- One story at a time: read the folder, split it with that story's settings (Web Worker), fetch
  the full chapter list from TTC (pages of 1000), compare.

## Comparison (shared with the "So sánh & Upload" tab)

The analysis in `ResyncComparisonTable` moves to `utils/syncCompare.ts` (`compareChapters`), so a
scan and the tab always agree. Unchanged rules: a local chapter is compared with the remote one at
the same position; it is *changed* when the title differs or the word count differs by more than
3%; it is *new* when TTC has nothing there.

Verdict per story:

| State | When | Upload when selected | Preselected |
|-------|------|----------------------|-------------|
| `new` | no changed chapter, N new | chapters after the last chapter on TTC (append) | yes |
| `changed` | first changed chapter X | chapters X..last of the folder (overwrite, like "Range") | no |
| `synced` | nothing to do (says when TTC has more chapters than the folder) | — | — |
| `invalid` | pending folder errors, unreadable folder, nothing parsed, TTC error | — | — |

Uploads use the story's own price rules (`applyChapterPrices`), delay and unlock timer, and are
pinned to the active account. One job per story in the upload queue.

## UI

`SyncScanModal`, same layout as `AbandonCheckModal`: progress bar, highlighted row being scanned,
checkbox per row, "Đồng bộ" button to open the story, job badge, "Quét lại", footer button
"Upload (n)". Toolbar button "Quét chương mới" next to "Check vô hố".

## Testing

- `syncCompare.test.ts`: new only, changed (title / word count), synced, remote ahead, skip offset.
- `useSyncScan.test.tsx` (worker mocked like `useAbandonCheck.test.tsx`): folders filtered,
  verdicts, chapters queued per verdict with the account, preselection rule.
