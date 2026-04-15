import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [, , expectedDirArg = '.dist-baseline', actualDirArg = 'dist'] = process.argv;
const root = process.cwd();
const expectedDir = path.resolve(root, expectedDirArg);
const actualDir = path.resolve(root, actualDirArg);

async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, fullPath).split(path.sep).join('/'));
    }
  }
  return files;
}

async function hashFile(filePath) {
  const body = await readFile(filePath);
  return createHash('sha256').update(body).digest('hex');
}

async function assertDirectory(dir, label) {
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`${label} directory not found: ${dir}`);
  }
}

await assertDirectory(expectedDir, 'Expected');
await assertDirectory(actualDir, 'Actual');

const expectedFiles = (await listFiles(expectedDir)).sort();
const actualFiles = (await listFiles(actualDir)).sort();
const expectedSet = new Set(expectedFiles);
const actualSet = new Set(actualFiles);

const missing = expectedFiles.filter((file) => !actualSet.has(file));
const added = actualFiles.filter((file) => !expectedSet.has(file));
const changed = [];

for (const file of expectedFiles) {
  if (!actualSet.has(file)) continue;
  const [expectedHash, actualHash] = await Promise.all([
    hashFile(path.join(expectedDir, file)),
    hashFile(path.join(actualDir, file)),
  ]);
  if (expectedHash !== actualHash) changed.push(file);
}

if (missing.length === 0 && added.length === 0 && changed.length === 0) {
  console.log(`Build outputs match: ${expectedFiles.length} files compared.`);
  process.exit(0);
}

console.error('Build outputs differ.');
if (missing.length) {
  console.error(`Missing files (${missing.length}):`);
  for (const file of missing.slice(0, 30)) console.error(`  - ${file}`);
}
if (added.length) {
  console.error(`Added files (${added.length}):`);
  for (const file of added.slice(0, 30)) console.error(`  + ${file}`);
}
if (changed.length) {
  console.error(`Changed files (${changed.length}):`);
  for (const file of changed.slice(0, 30)) console.error(`  * ${file}`);
}
process.exit(1);
