// Lets plain Node (type stripping, no bundler) import the page loaders in web/lib: the `@/` alias, extensionless relative imports,
// folder imports and JSON without an import attribute. Used by scripts/prebuild-data.ts only (`node --import ./scripts/ts-hooks.mjs`).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = ['.ts', '.tsx', '.json', '.mjs', '.js'];

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  for (const e of EXT) if (existsSync(path.join(base, 'index' + e))) return path.join(base, 'index' + e);
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    let base = null;
    if (specifier.startsWith('@/')) base = path.join(WEB, specifier.slice(2));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base) {
      const file = resolveFile(base);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return { format: 'json', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
    }
    return next(url, context);
  },
});
