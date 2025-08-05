import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    category: z.string(),
    status: z.string(),
    allowComments: z.boolean(),
    convertBreaks: z.boolean(),
    entryHash: z.string(),
  }),
});

export const collections = {
  blog,
};
