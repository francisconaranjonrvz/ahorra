import { z } from 'zod';

export const customFieldTypeSchema = z.enum(['text', 'number', 'boolean', 'date', 'select']);

export const customFieldDefSchema = z
  .object({
    id: z.uuid(),
    household_id: z.uuid(),
    key: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/),
    label: z.string().min(1).max(60),
    type: customFieldTypeSchema,
    options: z.array(z.string()).nullable(),
    required: z.boolean(),
    applies_to: z.array(z.uuid()),
    sort_order: z.number().int(),
    is_archived: z.boolean(),
  })
  .refine((def) => def.type !== 'select' || (def.options?.length ?? 0) > 0, {
    message: 'Un campo de tipo select necesita al menos una opción',
    path: ['options'],
  });

export type CustomFieldDefDto = z.infer<typeof customFieldDefSchema>;

/** Valida `expenses.custom` (JSONB) contra las definiciones vigentes del household. */
export function buildCustomValueSchema(defs: CustomFieldDefDto[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const def of defs) {
    let field: z.ZodTypeAny;
    switch (def.type) {
      case 'text':
        field = z.string().max(500);
        break;
      case 'number':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'date':
        field = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
        break;
      case 'select':
        field = z.enum(def.options as [string, ...string[]]);
        break;
    }
    shape[def.key] = def.required ? field : field.optional().nullable();
  }
  return z.object(shape);
}
