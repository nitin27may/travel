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
];
export default config;
