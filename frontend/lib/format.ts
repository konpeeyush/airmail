/** 1536 → "1.5 KB", 5242880 → "5 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number(value.toFixed(1))} ${units[unit]}`;
}

/** Shortens long text quoted back in a message, keeping both ends: "abcdefghij…xyz@example.com". */
export function shorten(text: string, max = 40): string {
  if (text.length <= max) return text;
  const tail = Math.floor((max - 1) / 3);
  return `${text.slice(0, max - 1 - tail)}…${text.slice(-tail)}`;
}
