#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function assertFileContains(file, needle, label) {
  const ok = await exists(file);
  if (!ok) throw new Error(`${label}: missing file ${file}`);
  const txt = await readFile(file, 'utf8');
  if (!txt || !txt.includes(needle)) {
    throw new Error(`${label}: expected to contain '${needle}'`);
  }
}

async function main() {
  const distArg = process.argv[2];
  const root = resolve(process.cwd(), distArg || process.env.SANITY_DIST || 'astro-blog/dist');

  const home = join(root, 'index.html');
  const pdf = join(root, 'pdf-compress', 'index.html');

  await assertFileContains(home, '<title>Subaru is Running', 'Home page');
  await assertFileContains(pdf, 'PDF Compressor', 'PDF page');

  console.log('Sanity checks passed for:', root);
}

main().catch((err) => {
  console.error('Sanity check failed:', err.message || err);
  process.exit(1);
});

