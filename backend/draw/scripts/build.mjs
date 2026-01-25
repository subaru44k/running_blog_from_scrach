import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const outDir = resolve(root, 'dist');
await mkdir(outDir, { recursive: true });

const entries = [
  'src/handlers/uploadUrl.ts',
  'src/handlers/submit.ts',
  'src/handlers/secondaryStatus.ts',
  'src/handlers/secondaryWorker.ts',
  'src/handlers/leaderboard.ts',
];

await Promise.all(entries.map((entry) =>
  build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    outfile: join(outDir, entry.split('/').pop().replace('.ts', '.cjs')),
    treeShaking: false,
    footer: {
      js: 'module.exports = { handler };',
    },
    external: [],
  })
));

console.log('Built draw backend handlers into', outDir);
