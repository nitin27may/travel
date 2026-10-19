export interface VocabProblems { vocab: Record<string, unknown> & { v: string; t: Record<string, Record<string, string[]>> }; problems: string[]; entries: number }
export function buildVocab(input: { types: { nodes: Record<string, unknown>[] }; slice: { facets: Record<string, unknown>[] }; phrases?: Record<string, Record<string, string[]>> }): VocabProblems;
export function vocabText(vocab: unknown): string;
export const BASE_PARAMS: string[];
export const BASE_VALUES: Record<string, string[]>;
export const STOP_ALIASES: Set<string>;
export const AMBIGUOUS: Record<string, string>;
