import { z } from 'zod';

/**
 * Fuente única del contrato agent-parse-expense (cliente y Edge Function).
 * La Edge Function importa este fichero por ruta relativa — ver supabase/functions/_shared/contracts.ts.
 */

export const parseExpenseRequestSchema = z.object({
  household_id: z.uuid(),
  text: z.string().min(1).max(500),
  client_today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ParseExpenseRequest = z.infer<typeof parseExpenseRequestSchema>;

export const parsedExpenseSchema = z.object({
  amount_cents: z.number().int().min(1).max(100_000_000),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.uuid().nullable(),
  merchant: z.string().max(120).nullable(),
  note: z.string().max(500).nullable(),
  custom: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
});
export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;

/** Lo que devuelve el modelo (antes de la validación/reparación server-side). */
export const modelOutputSchema = z.object({
  status: z.enum(['ok', 'ambiguous', 'not_an_expense']),
  clarification: z.string().max(200).nullable().optional(),
  expenses: z.array(parsedExpenseSchema).max(5),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** Lo que recibe el cliente — siempre 200, el fallo del modelo no es un error HTTP. */
export const parseExpenseResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    run_id: z.uuid(),
    draft: modelOutputSchema,
  }),
  z.object({
    ok: z.literal(false),
    run_id: z.uuid(),
    reason: z.enum(['provider_error', 'rate_limited', 'timeout']),
    // extracción heurística de respaldo (regex), ver plan §3.2 fila 1
    prefill: z.object({
      amount_cents: z.number().int().nullable(),
      occurred_on: z.string().nullable(),
    }),
  }),
]);
export type ParseExpenseResponse = z.infer<typeof parseExpenseResponseSchema>;

// --- agent-analyze -----------------------------------------------------

export const analyzeRequestSchema = z.object({
  household_id: z.uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/),
});
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const insightSchema = z.object({
  type: z.enum(['trend', 'anomaly', 'budget_risk', 'saving_opportunity']),
  title: z.string().max(60),
  detail: z.string().max(240),
  category_id: z.uuid().nullable(),
  impact_cents: z.number().int().nullable(),
  severity: z.enum(['low', 'medium', 'high']),
});

export const suggestionSchema = z.object({
  title: z.string().max(60),
  detail: z.string().max(240),
  estimated_monthly_saving_cents: z.number().int().nullable(),
});

export const analyzeResponseSchema = z.object({
  period_month: z.string(),
  headline: z.string().max(120),
  insights: z.array(insightSchema),
  suggestions: z.array(suggestionSchema),
});
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
