export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(timestamp: number | string): string {
  if (!timestamp) return 'Unknown';
  let date: Date;
  if (typeof timestamp === 'string') {
    const num = parseInt(timestamp, 10);
    date = isNaN(num) ? new Date(timestamp) : new Date(num * (num < 1e11 ? 1000 : 1));
  } else {
    date = new Date(timestamp * (timestamp < 1e11 ? 1000 : 1));
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

