// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';

// https://astro.build/config
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://subaru-is-running.com',
  markdown: {
    remarkPlugins: [remarkBreaks],
  },
  integrations: [tailwind(), react()],
});
