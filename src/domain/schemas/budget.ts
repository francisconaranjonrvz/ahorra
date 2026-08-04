import { z } from 'zod';

export const budgetSchema = z.object({
  id: z.uuid(),
  household_id: z.uuid(),
  category_id: z.uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount_cents: z.number().int().nonnegative(),
  includes_descendants: z.boolean(),
});

export type BudgetDto = z.infer<typeof budgetSchema>;

/** Fila de la vista `v_budget_progress`. */
export const budgetProgressSchema = budgetSchema.extend({
  budget_id: z.uuid(),
  spent_cents: z.number().int().nonnegative(),
  is_top_level: z.boolean(),
});

export type BudgetProgressDto = z.infer<typeof budgetProgressSchema>;
