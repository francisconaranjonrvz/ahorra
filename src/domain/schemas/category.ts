import { z } from 'zod';

export const categorySchema = z.object({
  id: z.uuid(),
  household_id: z.uuid(),
  parent_id: z.uuid().nullable(),
  name: z.string().min(1).max(60),
  icon: z.string().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  kind: z.enum(['expense', 'income']),
  path: z.array(z.uuid()),
  depth: z.number().int().min(0).max(2),
  is_archived: z.boolean(),
  sort_order: z.number().int(),
});

export type CategoryDto = z.infer<typeof categorySchema>;
