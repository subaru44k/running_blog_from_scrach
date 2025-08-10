#!/usr/bin/env node
/*
  Normalize legacy Markdown line breaks by removing inline <br> tags.
  - Targets files in src/content/blog with year <= 2024 (from filename prefix).
  - Replaces <br>, <br/>, <br /> (any case, with attributes) plus following whitespace/newline with a single newline.
  - Leaves frontmatter untouched.
*/
import fs from 'fs';
import path from 'path';

const here = new URL('.', import.meta.url).pathname;
const ASTRO_ROOT = path.resolve(here, '..');
const BLOG_DIR = path.resolve(ASTRO_ROOT, 'src/content/blog');

function splitFrontmatter(src) {
  if (src.startsWith('---')) {
    const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (m) {
      const head = m[0];
      const body = src.slice(m[0].length);
      return { head, body };
    }
  }
  return { head: '', body: src };
}

function normalizeBody(body) {
  // Replace <br ...> followed by optional spaces/newline to exactly one newline
  const re = /<\s*br\b[^>]*\/?\s*>[ \t]*\r?\n?/gi;
  let out = body.replace(re, '\n');
  // Normalize CRLF to LF
  out = out.replace(/\r\n/g, '\n');
  return out;
}

function shouldProcess(filename) {
  const m = filename.match(/^(\d{4})-/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  return !Number.isNaN(y) && y <= 2024;
}

function main() {
  const entries = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  let changed = 0;
  for (const f of entries) {
    if (!shouldProcess(f)) continue;
    const full = path.join(BLOG_DIR, f);
    const src = fs.readFileSync(full, 'utf8');
    const { head, body } = splitFrontmatter(src);
    const outBody = normalizeBody(body);
    if (outBody !== body) {
      fs.writeFileSync(full, head + outBody, 'utf8');
      changed++;
      process.stdout.write(`normalized: ${f}\n`);
    }
  }
  process.stdout.write(`Done. Files changed: ${changed}\n`);
}

main();

