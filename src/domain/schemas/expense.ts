import { z } from 'zod';

export const expenseSchema = z.object({
  id: z.uuid(),
  household_id: z.uuid(),
  category_id: z.uuid().nullable(),
  amount_cents: z.number().int().positive(),
  currency: z.literal('EUR'),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().max(120).nullable(),
  note: z.string().max(500).nullable(),
  custom: z.record(z.string(), z.unknown()),
  source: z.enum(['manual', 'agent', 'import']),
  agent_run_id: z.uuid().nullable(),
  created_by: z.uuid(),
  // PostgREST devuelve timestamps con offset "+00:00" (no "Z") y precisión de
  // microsegundos — z.iso.datetime() por defecto exige "Z" y rechaza el offset.
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export type ExpenseDto = z.infer<typeof expenseSchema>;

/** Payload para crear un gasto desde la UI o desde un borrador del agente. */
export const newExpenseSchema = z.object({
  household_id: z.uuid(),
  category_id: z.uuid().nullable(),
  amount_cents: z.number().int().positive(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(['manual', 'agent', 'import']).default('manual'),
  agent_run_id: z.uuid().nullable().optional(),
  client_mutation_id: z.uuid(),
});

export type NewExpenseInput = z.infer<typeof newExpenseSchema>;
