// Shared pins and helpers for the SQ2s spike. Nothing here reads private data: the text is what a place card already shows.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, '.cache');
export const MODEL = {
  id: 'Supabase/gte-small',
  revision: '93b36ff09519291b77d6000d2e86bd8565378086',
  dtype: 'q8',
  file: 'onnx/model_quantized.onnx',
  sha256: '18dec105109b6004369799ca4761fb8fb413c64172c02147bcfac186b5c5f6cb',
  bytes: 34014426,
  dims: 384,
  pooling: 'mean',
  normalize: true,
};

/** What gets embedded and searched: only text a place card already shows (smart-search 9.2). */
export const cardText = (p) => {
  const where = [...p.areaChain].reverse().join(', ');
  return [`${p.name}.`, `${p.kindLabel}${where ? ` in ${where}` : ''}.`, p.summary, p.tags.length ? `${p.tags.join(', ')}.` : ''].filter(Boolean).join(' ');
};
