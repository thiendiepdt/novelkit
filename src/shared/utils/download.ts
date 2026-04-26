/**
 * Trigger a browser download for a text string.
 */
export function downloadAsTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a string for use as a filename.
 * Keeps Unicode letters, digits, spaces, and hyphens.
 */
export function sanitizeFilename(raw: string, maxLength: number = 60): string {
  return (
    raw
      .replace(/[^\w\u4E00-\u9FFF\u0100-\u024F\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, maxLength) || 'untitled'
  );
}
