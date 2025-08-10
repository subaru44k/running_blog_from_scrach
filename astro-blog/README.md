 # Astro Blog

 This project generates a blog site using Astro and content collections. Blog posts are sourced from Markdown files under `src/content/blog`.

 Important: `old_blog_data/export_blog_1.txt` is only used as an import source during the initial migration. After conversion, Markdown files are the single source of truth. You do not need `export_blog_1.txt` at runtime or during development/build, and any editing tool (e.g., an admin app) should operate on the Markdown files, not on the export file.

 ## Setup

```sh
npm install
# Optional: only if you need to (re)import from Movable Type export
npm run convert:mt
npm run dev
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling. Tailwind is configured via `tailwind.config.cjs` and `postcss.config.cjs`. Utility classes are available in your components and pages.

## SEO & Site URL

To enable canonical and Open Graph URL meta tags, set your production site URL in `astro.config.mjs`:

```js
// astro.config.mjs
export default defineConfig({
  site: 'https://your-domain.com',
  integrations: [tailwind()],
});
```

## Project Structure

 Inside of your Astro project, you'll see the following folders and files:

 ```text
 /
 ├── public/
 │   └── favicon.svg
 ├── src/
 │   ├── content/
 │   │   └── blog/           # Markdown posts (source of truth)
 │   ├── components/
 │   ├── layouts/
 │   └── pages/
 └── package.json
 ```

## Content model

Markdown files in `src/content/blog` include frontmatter validated by `src/content/config.ts`:

```yaml
---
title: My Post Title
date: 2024-08-10
author: Your Name
category: Misc
status: publish
allowComments: true
entryHash: abcdef123456
---

Post body in Markdown…
```

Only files with `status: publish` appear on the site. The legacy `convertBreaks` field from Movable Type is no longer used and may be omitted.

 ## Commands

 | Command               | Action                                                   |
 | :-------------------- | :------------------------------------------------------- |
| `npm install`         | Installs dependencies                                    |
| `npm run convert:mt`  | Converts the Movable Type export to markdown files (run once or when re-importing) |
| `npm run dev`         | Starts the dev server at `localhost:4321`                |
| `npm run build`       | Builds production site to `./dist/`                      |
| `npm run preview`     | Previews the built site locally                          |

## Using the blog

- Start dev: `npm run dev`, open `http://localhost:4321/`.
- Calendar and sidebar help navigate posts; click a date with posts or a title to open.
