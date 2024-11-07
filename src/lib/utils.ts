import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateItemCode(category: string, timestamp: number): string {
  // Format: CAT-YYMMDDHHMM-XXX
  // CAT: Category prefix (RAW, FIN, PKG, SPR)
  // YYMMDDHHMM: Timestamp
  // XXX: Random number for uniqueness
  
  const categoryPrefix = {
    raw: 'RAW',
    finished: 'FIN',
    packaging: 'PKG',
    spare: 'SPR',
  }[category] || 'ITM';

  const date = new Date(timestamp);
  const timeComponent = [
    date.getFullYear().toString().slice(-2),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getDate().toString().padStart(2, '0'),
    date.getHours().toString().padStart(2, '0'),
    date.getMinutes().toString().padStart(2, '0'),
  ].join('');

  const randomComponent = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `${categoryPrefix}-${timeComponent}-${randomComponent}`;
}