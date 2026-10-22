/** RFC 4180 quoting: wrap in quotes when the value has a comma, quote, CR or LF; double inner quotes. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 with a BOM so spreadsheets open accented place names correctly; CRLF line ends. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
