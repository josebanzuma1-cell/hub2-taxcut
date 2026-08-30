/* Lets plain `node` resolve the tsconfig path aliases (@kit/*, @data/*) that
   Vite handles during the Astro build. Without this the model modules are only
   runnable inside a bundler, which would mean the math could not be tested
   independently — and on this site the math is the product. */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ALIASES = { '@kit/': 'src/kit/', '@data/': 'src/data/', '@components/': 'src/components/' };

registerHooks({
  resolve(specifier, context, nextResolve) {
    for (const [prefix, target] of Object.entries(ALIASES)) {
      if (specifier.startsWith(prefix)) {
        const rel = specifier.slice(prefix.length);
        const abs = path.join(root, target, rel.endsWith('.ts') ? rel : `${rel}.ts`);
        return nextResolve(pathToFileURL(abs).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
