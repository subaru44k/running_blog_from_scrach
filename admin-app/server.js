#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');

// Directory of Astro blog markdown posts
const BLOG_DIR = path.resolve(__dirname, '../astro-blog/src/content/blog');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));

// List posts
app.get('/', (req, res) => {
  const posts = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  res.render('list', { posts });
});

// Show 'new post' form
app.get('/new', (req, res) => {
  res.render('edit', { post: null, content: '' });
});

// Create new post
app.post('/new', (req, res) => {
  const { filename, content } = req.body;
  if (!filename.endsWith('.md')) {
    return res.status(400).send('Filename must end with .md');
  }
  const target = path.join(BLOG_DIR, filename);
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
  const content = fs.readFileSync(target, 'utf8');
  res.render('edit', { post: fn, content });
});

// Save edit
app.post('/edit/:filename', (req, res) => {
  const fn = req.params.filename;
  const { content } = req.body;
  const target = path.join(BLOG_DIR, fn);
  if (!fn.endsWith('.md') || !fs.existsSync(target)) {
    return res.status(404).send('Post not found');
  }
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Admin UI running at http://localhost:${port}`);
});
