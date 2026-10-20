import { sizedImage } from '@/lib/format/image';

/**
 * The renditions a globe card asks for: 320 and 640 only, never the 960 (review S10, principle P8). The card is 320 px wide, so a
 * 2x screen takes the 640; a phone sheet that spans the screen still takes the 640 rather than a heavier file.
 */
export function cardImageSources(url: string): { src: string; srcSet: string | undefined; sizes: string } {
  const small = sizedImage(url, 320);
  const large = sizedImage(url, 640);
  // a URL with no renditions (another host) comes back unchanged for both widths: no srcset then
  return { src: large, srcSet: small !== large ? `${small} 320w, ${large} 640w` : undefined, sizes: '(max-width: 639px) 100vw, 320px' };
}
