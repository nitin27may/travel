import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['out/**', '.next/**', '.fixture-*/**', '.generated/**', 'next-env.d.ts', 'node_modules/**'],
  },
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@radix-ui/*'], message: 'Use Base UI (@base-ui/react), not Radix.' }] }],
    },
  },
  {
    // Review NAV-2 C1: a browser that blocks site data throws on ACCESS to the property, so every read goes through lib/storage/safe.ts.
    files: ['**/*.{ts,tsx,mjs}'],
    ignores: ['lib/storage/safe.ts', 'lib/mine/storage.ts', 'tests/**', 'scripts/**'],
    rules: {
      'no-restricted-globals': ['error', ...['localStorage', 'sessionStorage'].map((name) => ({ name, message: 'Use lib/storage/safe.ts (readLocal, writeLocal, readSession, ...): the property access itself can throw.' }))],
      'no-restricted-properties': ['error', ...['window', 'globalThis', 'self'].flatMap((object) => ['localStorage', 'sessionStorage'].map((property) => ({ object, property, message: 'Use lib/storage/safe.ts: the property access itself can throw.' })))],
    },
  },
];
export default config;
