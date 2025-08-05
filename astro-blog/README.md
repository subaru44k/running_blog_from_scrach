 # Astro Blog

 This project generates a blog site using Astro and content collections, sourcing posts from the Movable Type export in `old_blog_data/export_blog_1.txt`. Run the conversion tool before starting the dev server or building the site.

 ## Setup

```sh
npm install
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
 │   │   └── blog/
 │   ├── components/
 │   ├── layouts/
 │   └── pages/
 └── package.json
 ```

 ## Commands

 | Command               | Action                                                   |
 | :-------------------- | :------------------------------------------------------- |
| `npm install`         | Installs dependencies                                    |
| `npm run convert:mt`  | Converts the Movable Type export to markdown files (run once) |
| `npm run dev`         | Starts the dev server at `localhost:4321`                |
| `npm run build`       | Builds production site to `./dist/`                      |
| `npm run preview`     | Previews the built site locally                          |

 ## Using the blog

 - Navigate to `http://localhost:4321/blog/` to view the blog listing.
 - Click on a post title to read an individual post.
