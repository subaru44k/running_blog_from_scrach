#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const matter = require('gray-matter');
const dayjs = require('dayjs');
const slugify = require('slugify');
const { marked } = require('marked');

// Fixed category options for new/edit forms
const CATEGORIES = ['練習(デフォルト)', '練習(低)', '練習(中)', '練習(強)', '試合'];

// Directory of Astro blog markdown posts
const BLOG_DIR = path.resolve(__dirname, '../astro-blog/src/content/blog');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));

// helpers
function readPost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  return { data: parsed.data || {}, body: parsed.content || '', raw };
}

function writePost(data, body) {
  const fm = matter.stringify(body || '', data);
  return fm;
}

function listFiles() {
  return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
}

// List posts with metadata
app.get('/', (req, res) => {
  const files = listFiles();
  const posts = files
    .map((f) => {
      try {
        const { data } = readPost(path.join(BLOG_DIR, f));
        return {
          file: f,
          title: data.title || f,
          date: data.date ? new Date(data.date) : null,
          status: data.status || 'draft',
          category: data.category || '',
        };
      } catch (e) {
        return { file: f, title: f, date: null, status: 'unknown', category: '' };
      }
    })
    .sort((a, b) => (b.date?.valueOf() || 0) - (a.date?.valueOf() || 0));
  res.render('list', { posts });
});

// Show 'new post' form
app.get('/new', (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  const defaults = {
    title: '',
    date: today,
    author: 'subaru44k',
    category: CATEGORIES[0],
    status: 'draft',
    allowComments: false,
  };
  res.render('edit', { file: null, data: defaults, body: '', categories: CATEGORIES });
});

// Create new post
app.post('/new', (req, res) => {
  const { title, date, author, category, status, allowComments, body } = req.body;
  const ymd = dayjs(date || new Date()).format('YYYY-MM-DD');
  const slug = slugify(String(title || 'untitled'), { lower: true, strict: true }) || 'untitled';
  const filename = `${ymd}-${slug}.md`;
  const target = path.join(BLOG_DIR, filename);
  if (fs.existsSync(target)) {
    return res.status(400).send('A post with this date/title already exists. Change the title or date.');
  }
  const categoryValue = CATEGORIES.includes(category) ? category : CATEGORIES[0];
  const data = {
    title: title || 'Untitled',
    date: new Date(ymd),
    author: author || 'subaru44k',
    category: categoryValue,
    status: status || 'draft',
    allowComments: Boolean(allowComments),
    entryHash: Math.random().toString(16).slice(2, 10),
  };
  const content = writePost(data, body || '');
  fs.writeFileSync(target, content, 'utf8');
  res.redirect('/');
});

// Show edit form
app.get('/edit/:filename', (req, res) => {
  const fn = req.params.filename;
  const target = path.join(BLOG_DIR, fn);
  if (!fn.endsWith('.md') || !fs.existsSync(target)) {
    return res.status(404).send('Post not found');
  }
  const { data, body } = readPost(target);
  // Normalize booleans for form checkboxes
  data.allowComments = Boolean(data.allowComments);
  res.render('edit', { file: fn, data, body, categories: CATEGORIES });
});

// Save edit
app.post('/edit/:filename', (req, res) => {
  const fn = req.params.filename;
  const { title, date, author, category, status, allowComments, body } = req.body;
  const target = path.join(BLOG_DIR, fn);
  if (!fn.endsWith('.md') || !fs.existsSync(target)) {
    return res.status(404).send('Post not found');
  }
  const { data: current } = readPost(target);
  const categoryValue2 = CATEGORIES.includes(category) ? category : (current.category && CATEGORIES.includes(current.category) ? current.category : CATEGORIES[0]);
  const data = {
    ...current,
    title: title || current.title,
    date: new Date(dayjs(date || current.date).format('YYYY-MM-DD')),
    author: author ?? current.author,
    category: categoryValue2,
    status: status ?? current.status,
    allowComments: Boolean(allowComments),
  };
  const content = writePost(data, body || '');
  fs.writeFileSync(target, content, 'utf8');
  res.redirect('/');
});

// Delete post
app.post('/delete/:filename', (req, res) => {
  const fn = req.params.filename;
  const target = path.join(BLOG_DIR, fn);
  if (fn.endsWith('.md') && fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  res.redirect('/');
});

// Live preview of Markdown body (does not save)
app.post('/preview', (req, res) => {
  const { body } = req.body;
  try {
    const html = marked.parse(body || '');
    res.send(`<!doctype html><meta charset="utf-8"><title>Preview</title><div>${html}</div>`);
  } catch (e) {
    res.status(400).send('Failed to render preview');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Admin UI running at http://localhost:${port}`);
});
