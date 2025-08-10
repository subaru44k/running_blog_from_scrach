# Astro Blog Admin

This is a standalone admin UI to manage (list, add, edit, delete) blog posts stored as Markdown files in the Astro blog repository. The admin edits files in `../astro-blog/src/content/blog` directly — no database.

## Setup

```bash
cd admin-app
npm install
npm start
```

By default, it connects to the `astro-blog/src/content/blog` folder next door. Make sure you have the Astro blog repo alongside this folder.

Features
- Lists posts with title, date, status, category, and filename.
- Create/edit posts with structured frontmatter fields (title, date, author, category, status, allowComments, convertBreaks) and a Markdown body.
- Auto-generates filenames like `YYYY-MM-DD-my-title.md` for new posts.
- Preview Markdown rendering without saving.

Notes
- The blog app reads Markdown frontmatter per `src/content/config.ts`; only `status: publish` is visible on the public site.
- The old Movable Type export (`old_blog_data/export_blog_1.txt`) is not used here; Markdown is the single source of truth.
EOF
