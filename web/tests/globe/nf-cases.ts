/** URL cases for the `nf` key: the other keys, their encoding and the hash stay as they were. */
export const nfQueryCases: { url: string; on: boolean; out: string }[] = [
  { url: '/globe/', on: false, out: '/globe/?nf=0' },
  { url: '/globe/it/?c=12.500,42.000,5.00', on: false, out: '/globe/it/?c=12.500,42.000,5.00&nf=0' },
  { url: '/globe/it/?c=12.500,42.000,5.00&nf=0', on: true, out: '/globe/it/?c=12.500,42.000,5.00' },
  { url: '/globe/?nf=0', on: true, out: '/globe/' },
  { url: '/globe/?nf=0#top', on: true, out: '/globe/#top' },
];
