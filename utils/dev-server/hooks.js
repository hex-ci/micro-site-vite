import { resolve as resolvePath } from 'node:path';
import { transform } from 'esbuild';
import { fileURLToPath } from "node:url";
import { getDefineByEnv } from '../helper.js';

const includeRegex = /\/src\/[a-z0-9-_/\\]+\/server\//i;
const excludeRegex = /\/node_modules\//i;

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const resolve = (str) => resolvePath(__dirname, `../../${str}`);

export async function load(url, context, nextLoad) {
  if (includeRegex.test(url) && !excludeRegex.test(url)) {
    const { source: rawSource } = await nextLoad(url, { ...context, format: 'module' });

    const result = await transform(rawSource.toString(), {
      minifyWhitespace: false,
      minifyIdentifiers: false,
      minifySyntax: true,
      sourcemap: false,
      treeShaking: true,
      format: 'esm',
      define: {
        'import.meta.env': JSON.stringify({
          ...getDefineByEnv('development', resolve(''), '', false),
        }),
      },
    });

    return {
      format: 'module',
      shortCircuit: true,
      source: result.code,
    };
  }

  // Let Node.js handle all other URLs.
  return nextLoad(url);
}
