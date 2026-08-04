import { supabase } from '@/data/supabase';
import {
  expenseSchema,
  newExpenseSchema,
  type ExpenseDto,
  type NewExpenseInput,
} from '@/domain/schemas/expense';

/**
 * Fase 1: escritura directa contra Supabase (sin cola offline todavía — plan §2.3).
 * `client_mutation_id` ya viaja en el payload para que la idempotencia del outbox
 * futuro no requiera tocar esta firma.
 */
export async function createExpense(input: NewExpenseInput): Promise<ExpenseDto> {
  const payload = newExpenseSchema.parse(input);
  const { data, error } = await supabase.from('expenses').insert(payload).select().single();
  if (error) throw error;
  return expenseSchema.parse(data);
}

export async function listExpenses(params: {
  householdId: string;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD exclusive
}): Promise<ExpenseDto[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('household_id', params.householdId)
    .is('deleted_at', null)
    .gte('occurred_on', params.from)
    .lt('occurred_on', params.to)
    .order('occurred_on', { ascending: false });

  if (error) throw error;
  return expenseSchema.array().parse(data);
}

export async function softDeleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
