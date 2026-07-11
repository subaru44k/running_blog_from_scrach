#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
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

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listHtmlFiles(path));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

async function assertAstroAssetsExist(root) {
  const htmlFiles = await listHtmlFiles(root);
  const missing = new Set();
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["']\/?(_astro\/[^"'?#]+)[^"']*["']/g)) {
      const assetPath = join(root, match[1]);
      if (!await exists(assetPath)) missing.add(match[1]);
    }
  }
  if (missing.size > 0) {
    throw new Error(`HTML references missing Astro assets: ${[...missing].join(', ')}`);
  }
}

async function main() {
  const distArg = process.argv[2];
  const root = resolve(process.cwd(), distArg || process.env.SANITY_DIST || 'astro-blog/dist');

  const home = join(root, 'index.html');
  const pdf = join(root, 'pdf-compress', 'index.html');

  await assertFileContains(home, '<title>Subaru is Running', 'Home page');
  await assertFileContains(pdf, 'PDF圧縮', 'PDF page');
  await assertAstroAssetsExist(root);

  console.log('Sanity checks passed for:', root);
}

main().catch((err) => {
  console.error('Sanity check failed:', err.message || err);
  process.exit(1);
});
