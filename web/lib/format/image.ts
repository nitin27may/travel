/** Commons Special:FilePath URLs take ?width=N; other hosts are used as given. */
export function sizedImage(url: string, width: number): string {
  if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(url)) return url;
  const base = url.replace(/[?&]width=\d+/, '');
  return `${base}${base.includes('?') ? '&' : '?'}width=${width}`;
}
