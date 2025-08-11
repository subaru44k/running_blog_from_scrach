import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    category: z.string(),
    status: z.string(),
    allowComments: z.boolean(),
    // Legacy field from Movable Type; no longer used by the site
    convertBreaks: z.boolean().optional(),
    entryHash: z.coerce.string(),
  }),
});

export const collections = {
  blog,
};
