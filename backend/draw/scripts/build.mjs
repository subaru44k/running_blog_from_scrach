import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const outDir = resolve(root, 'dist');
const artifactsDir = resolve(root, 'artifacts');
await mkdir(outDir, { recursive: true });
await mkdir(artifactsDir, { recursive: true });

const entries = [
  'src/handlers/prompt.ts',
  'src/handlers/uploadUrl.ts',
  'src/handlers/submit.ts',
  'src/handlers/leaderboard.ts',
  'src/handlers/monthlyCleanup.ts',
];

const zipNames = {
  prompt: 'draw-prompt.zip',
  uploadUrl: 'draw-upload-url.zip',
  submit: 'draw-submit.zip',
  leaderboard: 'draw-leaderboard.zip',
  monthlyCleanup: 'draw-monthly-cleanup.zip',
};

await Promise.all(entries.map(async (entry) => {
  const baseName = entry.split('/').pop().replace('.ts', '');
  const outfile = join(outDir, `${baseName}.cjs`);
  await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    outfile,
    treeShaking: false,
    footer: {
      js: 'module.exports = { handler };',
    },
    external: [],
  });

  const zipPath = join(artifactsDir, zipNames[baseName]);
  execFileSync('zip', ['-q', '-j', zipPath, outfile, `${outfile}.map`], {
    cwd: root,
  });
}));

console.log('Built draw backend handlers into', outDir, 'and packaged zip artifacts into', artifactsDir);
