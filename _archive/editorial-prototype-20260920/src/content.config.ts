import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sharedFields = {
	title: z.string(),
	description: z.string(),
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	tags: z.array(z.string()).default([]),
	draft: z.boolean().default(false),
};

const notes = defineCollection({
	loader: glob({ base: './src/content/notes', pattern: '**/*.{md,mdx}' }),
	schema: z.object({ ...sharedFields, number: z.number().int().positive() }),
});

const articles = defineCollection({
	loader: glob({ base: './src/content/articles', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		...sharedFields,
		featured: z.boolean().default(false),
		readingTime: z.string(),
	}),
});

export const collections = { notes, articles };
