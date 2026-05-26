import { z } from 'zod';

// Birth-detail form — the join key for every user.
// Length caps keep an attacker from padding the Gemini prompt with megabytes.
const formSchema = z.object({
  name:   z.string().trim().min(1, 'name is required').max(80),
  gender: z.string().trim().max(20).optional().nullable(),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time must be HH:MM'),
  city:   z.string().trim().min(1, 'city is required').max(80),
  phone:  z.string().trim().max(20).optional().nullable(),
});

// 20KB ceiling — a real natal chart's fact sheet runs ~6–15KB depending on
// dasha density and timeline depth. Stops megabyte-padding without rejecting
// legitimate charts.
const factSheetSchema = z.string().max(20_000);

export const interpretBody = z.object({
  form: formSchema,
  factSheet: factSheetSchema,
});

export const dailyBody = z.object({
  form: formSchema,
  ctx:  z.string().max(4_000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const chatBody = z.object({
  form: formSchema.optional(),
  factSheet: factSheetSchema.optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2_000),
  })).min(1).max(50),
});

export const palmBody = z.object({
  form: formSchema,
  image: z.string().min(100).max(7_000_000),
});

export const userQuery = formSchema.partial({ gender: true }).extend({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
