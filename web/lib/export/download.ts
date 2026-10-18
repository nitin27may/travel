export type FileKind = 'gpx' | 'kml' | 'ics' | 'csv';
const MIME: Record<FileKind, string> = {
  gpx: 'application/gpx+xml;charset=utf-8',
  kml: 'application/vnd.google-earth.kml+xml;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
};

/** `<slug>.<ext>`, matching the toast: "Downloaded dolomites-2027.gpx". */
export function fileName(slug: string, kind: FileKind | 'pdf'): string {
  return `${slug}.${kind}`;
}

export function saveFile(name: string, kind: FileKind, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: MIME[kind] }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
