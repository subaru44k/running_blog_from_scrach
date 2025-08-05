#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Paths
const dataFile = path.resolve(__dirname, '../../old_blog_data/export_blog_1.txt');
const outDir = path.resolve(__dirname, '../src/content/blog');

// Ensure output directory exists
fs.mkdirSync(outDir, { recursive: true });

// Read and split entries
const text = fs.readFileSync(dataFile, 'utf8');
const entries = text.split(/^--------$/m).map(s => s.trim()).filter(Boolean);

entries.forEach(entry => {
  // Split header/body by '-----' separators
  const parts = entry.split(/^-----$/m).map(s => s.trim());
  const headerLines = parts[0].split(/\r?\n/).filter(Boolean);
  let bodyLines = (parts[1] || '').split(/\r?\n/);
  // Drop the Movable Type "BODY:" marker if present
  if (bodyLines[0] === 'BODY:') {
    bodyLines.shift();
  }

  const meta = {};
  headerLines.forEach(line => {
    const [key, ...rest] = line.split(':');
    meta[key.trim().toLowerCase().replace(/ /g, '_')] = rest.join(':').trim();
  });

  // Parse date, format to ISO
  const [month, day, year, time] = meta.date.split(/[\/ ]/).slice(0, 4);
  const isoDate = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${time}`;

  // Use hash as slug to handle arbitrary titles
  const slug = meta.cf50_gbentryhash;
  const filename = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}-${slug}.md`;

  // Build frontmatter
  const fm = [
    '---',
    `title: ${JSON.stringify(meta.title)}`,
    `date: '${isoDate}'`,
    `author: ${JSON.stringify(meta.author)}`,
    `category: ${JSON.stringify(meta.primary_category)}`,
    `status: ${JSON.stringify(meta.status)}`,
    `allowComments: ${meta.allow_comments === '1'}`,
    `convertBreaks: ${meta.convert_breaks === '1'}`,
    `entryHash: ${JSON.stringify(meta.cf50_gbentryhash)}`,
    '---',
    ''
  ].join('\n');

  const content = fm + bodyLines.join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, filename), content, 'utf8');
  console.log(`Written: ${filename}`);
});
