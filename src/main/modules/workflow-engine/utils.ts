export function convertToBytes(size: number, unit: string): number {
  switch (unit) {
    case 'KB':
      return size * 1024;
    case 'MB':
      return size * 1024 * 1024;
    case 'GB':
      return size * 1024 * 1024 * 1024;
    default:
      return size;
  }
}
