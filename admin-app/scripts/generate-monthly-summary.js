#!/usr/bin/env node
// Generate monthly workout summaries from blog posts.
// Heuristics:
// - Split sequences are indicated by '→'
// - Times like 3'15" or 3:15 are parsed as mm:ss
// - Infer distance per split from time bands:
//   <=120s → 0.4km (track reps)
//   120–540s → 1.0km
//   540–1500s → 5.0km
//   >1500s → 10.0km
// Output: MD files under astro-blog/src/content/blog with category 'サマリー'
// NOTE: This script writes files but we will not commit them automatically.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const BLOG_DIR = path.resolve(__dirname, '../../astro-blog/src/content/blog');

function parseFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  return { data: data || {}, body: content || '', raw };
}

function listMarkdownFiles() {
  return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
}

function ymdFromSlug(slug) {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})-/);
  return m ? m[1] : null;
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

function parseTimesFromLine(line) {
  // Extract time tokens like 3'15", 3’15, 3:15, 12'34, etc.
  const re = /(\d{1,2})\s*(?:['’′:]|分)\s*(\d{1,2})(?:["”″]|秒)?/g;
  const results = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (!Number.isNaN(min) && !Number.isNaN(sec) && sec < 60) {
      results.push(min * 60 + sec);
    }
  }
  return results;
}

function inferDistanceKm(medianSec) {
  if (medianSec <= 120) return 0.4; // likely 400m reps
  if (medianSec <= 540) return 1.0; // typical km splits
  if (medianSec <= 1500) return 5.0; // 5k blocks
  return 10.0; // 10k blocks
}

function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

function analyzePost(file, data, body) {
  // Return one of:
  // - { date, slug, sequences: [{ times, distKm }, ...] } when split lines are present
  // - { date, slug, overall: { distKm, sec } } when only overall distance/time can be inferred
  const slug = file.replace(/\.md$/, '');
  const date = data.date ? new Date(data.date) : (ymdFromSlug(slug) ? new Date(ymdFromSlug(slug)) : null);
  if (!date) return null;
  if (data.category === 'サマリー') return null; // skip generated summaries
  // Find lines containing '→' as indicator for split sequences
  const lines = body.split(/\r?\n/);
  const sequences = [];
  for (const line of lines) {
    if (line.includes('→')) {
      const times = parseTimesFromLine(line);
      if (times.length >= 2) {
        const med = median(times);
        const distKm = inferDistanceKm(med);
        sequences.push({ times, distKm });
      }
    }
  }
  if (sequences.length) return { date, slug, title: data.title || slug, sequences };

  // Otherwise, try to infer overall distance/time from free text
  function extractOverall(bodyText) {
    const text = bodyText.normalize('NFKC');
    const distances = [];
    // km patterns (e.g., 12km, 3.5 km, 30キロ)
    const kmRe = /(\d{1,3}(?:[\.,]\d+)?)\s*(?:km|KM|Km|ｋｍ|ＫＭ|キロ)/g;
    let m;
    while ((m = kmRe.exec(text)) !== null) {
      const n = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(n) && n > 0 && n < 500) distances.push(n);
    }
    // explicit total distance: 合計/total X km
    let explicitTotalKm = null;
    const kmTotalRe = /(合計|total)\s*(\d{1,3}(?:[\.,]\d+)?)\s*(?:km|KM|Km|ｋｍ|ＫＭ|キロ)/gi;
    while ((m = kmTotalRe.exec(text)) !== null) {
      const n = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(n)) explicitTotalKm = Math.max(explicitTotalKm ?? 0, n);
    }
    // set patterns like 400m×10, 1000m x 5
    const setRe = /(\d{3,4})\s*m\s*[x×]\s*(\d{1,3})/gi;
    let totalSetKm = 0;
    while ((m = setRe.exec(text)) !== null) {
      const meters = parseInt(m[1], 10);
      const reps = parseInt(m[2], 10);
      if (meters > 0 && reps > 0 && meters < 50000) totalSetKm += (meters / 1000) * reps;
    }
    if (totalSetKm > 0) distances.push(totalSetKm);

    // durations: prefer long durations to avoid picking split times
    const durations = [];
    // HH:MM:SS
    const hmsRe = /(\d{1,2}):(\d{2}):(\d{2})/g;
    while ((m = hmsRe.exec(text)) !== null) {
      const h = parseInt(m[1], 10), mm = parseInt(m[2], 10), ss = parseInt(m[3], 10);
      const sec = h * 3600 + mm * 60 + ss;
      if (mm < 60 && ss < 60) durations.push(sec);
    }
    // H時間M分S秒, M分S秒, H時間
    const jpRe = /(\d{1,2})\s*時間\s*(\d{1,2})?\s*分?\s*(\d{1,2})?\s*秒?/g;
    while ((m = jpRe.exec(text)) !== null) {
      const h = parseInt(m[1] || '0', 10);
      const mm = parseInt(m[2] || '0', 10);
      const ss = parseInt(m[3] || '0', 10);
      durations.push(h * 3600 + mm * 60 + ss);
    }
    const jpMinSecRe = /(\d{1,2})\s*分\s*(\d{1,2})\s*秒/g;
    while ((m = jpMinSecRe.exec(text)) !== null) {
      const mm = parseInt(m[1], 10), ss = parseInt(m[2], 10);
      const sec = mm * 60 + ss;
      if (sec >= 300) durations.push(sec); // >=5min to avoid capturing split times
    }
    const jpMinOnlyRe = /(\d{1,2})\s*分(?![\w\d])/g;
    while ((m = jpMinOnlyRe.exec(text)) !== null) {
      const mm = parseInt(m[1], 10);
      const sec = mm * 60;
      if (sec >= 300) durations.push(sec);
    }
    // English-like: 1h30m, 90min, 45m
    const hminRe = /(\d{1,2})\s*h\s*(\d{1,2})\s*m/gi;
    while ((m = hminRe.exec(text)) !== null) {
      durations.push(parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60);
    }
    const hOnlyRe = /(\d{1,2})\s*h(?![a-z])/gi;
    while ((m = hOnlyRe.exec(text)) !== null) {
      durations.push(parseInt(m[1], 10) * 3600);
    }
    const minRe = /(\d{1,3})\s*(?:min|mins|minutes)/gi;
    while ((m = minRe.exec(text)) !== null) {
      const mm = parseInt(m[1], 10);
      const sec = mm * 60;
      if (sec >= 300) durations.push(sec);
    }
    // MM:SS (e.g., 45:00) treat as duration if >=5min
    const mmssRe = /(\d{1,2}):(\d{2})(?!:)/g;
    while ((m = mmssRe.exec(text)) !== null) {
      const mm = parseInt(m[1], 10), ss = parseInt(m[2], 10);
      if (ss < 60) {
        const sec = mm * 60 + ss;
        if (sec >= 300) durations.push(sec);
      }
    }

    let overallKm = 0;
    if (explicitTotalKm != null) {
      overallKm = explicitTotalKm;
    } else if (distances.length) {
      overallKm = distances.reduce((a, b) => a + b, 0);
    }
    const longDurations = durations.filter((s) => s >= 300);
    const overallSec = longDurations.length ? longDurations.reduce((a, b) => a + b, 0) : 0;
    if (overallKm > 0 || overallSec > 0) return { distKm: overallKm, sec: overallSec };
    return null;
  }

  const overall = extractOverall(body);
  if (!overall) return null;
  return { date, slug, title: data.title || slug, overall };
}

function formatPace(secPerKm) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60).toString().padStart(2, '0');
  return `${m}'${s}"/km`;
}

function makeSummaryMd(month, stats) {
  // stats: { runs, posts: [{slug, date, distanceKm, timeSec, bestPace}], totalKm, totalSec, pacesSecPerKm[] }
  const title = `${month} 練習サマリー`;
  const dateStr = `${month}-01T12:00:00.000Z`;
  const author = 'subaru44k';
  const entryHash = Math.random().toString(16).slice(2, 10);
  const best = Math.min(...stats.pacesSecPerKm);
  const med = median(stats.pacesSecPerKm);
  const avg = stats.pacesSecPerKm.reduce((a, b) => a + b, 0) / (stats.pacesSecPerKm.length || 1);
  const totalKm = stats.totalKm;
  const totalSec = stats.totalSec;
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);
  const totalS = Math.floor(totalSec % 60).toString().padStart(2, '0');

  const lines = [];
  // Note: Do not render the title here because the layout already renders frontmatter.title
  lines.push('- 走行回数: ' + stats.runs);
  lines.push('- 総距離: ' + totalKm.toFixed(1) + ' km');
  lines.push('- 総時間: ' + `${totalH}:${String(totalM).padStart(2, '0')}:${totalS}`);
  lines.push('- 平均ペース: ' + formatPace(avg));
  lines.push('- 中央ペース: ' + formatPace(med));
  lines.push('- ベストペース: ' + formatPace(best));
  lines.push('');
  lines.push('## ハイライト（上位5本）');
  const top = [...stats.posts]
    .sort((a, b) => a.bestPace - b.bestPace)
    .slice(0, 5);
  for (const p of top) {
    const d = p.date.toISOString().slice(0,10);
    const linkText = `${d} ${p.title}`.trim();
    lines.push(`- [${linkText}](/${p.slug}/): ${formatPace(p.bestPace)} (${p.distanceKm.toFixed(1)}km)`);
  }
  lines.push('');
  lines.push('> 自動生成（実験的機能）: `→` 区切りのスプリットから距離を推定しています。400m/1km/5km/10km に誤分類の可能性あり。');
  const content = lines.join('\n') + '\n';

  const frontmatter = {
    title,
    date: new Date(dateStr),
    author,
    category: 'サマリー',
    status: 'publish',
    allowComments: false,
    entryHash,
  };
  return matter.stringify(content, frontmatter);
}

function main() {
  const files = listMarkdownFiles();
  const FORCE = process.argv.includes('--force');
  // Build month -> all posts (non-summary, published) for run counts
  const allPostsByMonth = new Map();
  for (const file of files) {
    const fp = path.join(BLOG_DIR, file);
    try {
      const { data } = parseFrontmatter(fp);
      if (!data || data.category === 'サマリー') continue;
      if (data.status && data.status !== 'publish') continue;
      const d = data.date ? new Date(data.date) : (ymdFromSlug(file) ? new Date(ymdFromSlug(file)) : null);
      if (!d) continue;
      const key = monthKey(d);
      (allPostsByMonth.get(key) || allPostsByMonth.set(key, []).get(key)).push({ slug: file.replace(/\.md$/, ''), date: d });
    } catch (_) {}
  }
  const analyses = [];
  for (const file of files) {
    const fp = path.join(BLOG_DIR, file);
    try {
      const { data, body } = parseFrontmatter(fp);
      if (!data || !body) continue;
      const a = analyzePost(file, data, body);
      if (a) analyses.push(a);
    } catch (_) {}
  }
  if (!analyses.length) {
    console.log('No analyzable posts found.');
    return;
  }
  // Group by month
  const byMonth = new Map();
  for (const a of analyses) {
    const key = monthKey(a.date);
    (byMonth.get(key) || byMonth.set(key, []).get(key)).push(a);
  }

  let created = 0;
  for (const [month, arr] of byMonth) {
    // 走行回数は投稿数に合わせる
    const monthPosts = allPostsByMonth.get(month) || [];
    const runs = monthPosts.length;
    let totalKm = 0;
    let totalSec = 0;
    const pacesSecPerKm = [];
    const perPost = [];
    for (const a of arr) {
      let postKm = 0;
      let postSec = 0;
      let postBest = Infinity;
      if (a.sequences) {
        for (const seq of a.sequences) {
          for (const t of seq.times) {
            postKm += seq.distKm;
            postSec += t;
            const pace = t / seq.distKm;
            pacesSecPerKm.push(pace);
            if (pace < postBest) postBest = pace;
          }
        }
      } else if (a.overall) {
        postKm = a.overall.distKm || 0;
        postSec = a.overall.sec || 0;
        if (postKm > 0 && postSec > 0) {
          const pace = postSec / postKm;
          pacesSecPerKm.push(pace);
          postBest = pace;
        }
      }
      if (postKm > 0 || postSec > 0) {
        perPost.push({ slug: a.slug, title: a.title, date: a.date, distanceKm: postKm, timeSec: postSec, bestPace: postBest });
        totalKm += postKm;
        totalSec += postSec;
      }
    }
    if (!perPost.length) continue;
    // Avoid duplicating if a summary for this month already exists (unless --force)
    const existing = fs.readdirSync(BLOG_DIR).filter((f) => f.startsWith(`${month}-summary-`) && f.endsWith('.md'));
    if (existing.length && !FORCE) continue;
    if (existing.length && FORCE) {
      for (const f of existing) {
        try { fs.unlinkSync(path.join(BLOG_DIR, f)); } catch (_) {}
      }
    }
    const md = makeSummaryMd(month, { runs, posts: perPost, totalKm, totalSec, pacesSecPerKm });
    const entryHash = Math.random().toString(16).slice(2, 10);
    const filename = `${month}-summary-${entryHash}.md`;
    const outPath = path.join(BLOG_DIR, filename);
    fs.writeFileSync(outPath, md, 'utf8');
    created++;
    console.log('Created', filename);
  }
  console.log(`Done. Created ${created} summary file(s).`);
}

if (require.main === module) main();
