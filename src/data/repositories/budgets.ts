import { supabase } from '@/data/supabase';
import {
  budgetProgressSchema,
  budgetSchema,
  type BudgetDto,
  type BudgetProgressDto,
} from '@/domain/schemas/budget';

export async function listBudgets(params: {
  householdId: string;
  periodMonth: string;
}): Promise<BudgetDto[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('household_id', params.householdId)
    .eq('period_month', params.periodMonth);

  if (error) throw error;
  return budgetSchema.array().parse(data);
}

export async function upsertBudget(input: {
  household_id: string;
  category_id: string;
  period_month: string;
  amount_cents: number;
  includes_descendants?: boolean;
}): Promise<BudgetDto> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(input, { onConflict: 'household_id,category_id,period_month' })
    .select()
    .single();
  if (error) throw error;
  return budgetSchema.parse(data);
}

/** Presupuestos de nivel superior del mes (ver vista `v_budget_progress`, columna `is_top_level`). */
export async function listTopLevelBudgetProgress(params: {
  householdId: string;
  periodMonth: string; // YYYY-MM-01
}): Promise<BudgetProgressDto[]> {
  const { data, error } = await supabase
    .from('v_budget_progress')
    .select('*')
    .eq('household_id', params.householdId)
    .eq('period_month', params.periodMonth)
    .eq('is_top_level', true);

  if (error) throw error;
  return budgetProgressSchema.array().parse(data);
}

export async function listChildBudgetProgress(params: {
  householdId: string;
  periodMonth: string;
  parentCategoryId: string;
}): Promise<BudgetProgressDto[]> {
  // Los hijos son los presupuestos del mes cuya categoría cuelga de parentCategoryId;
  // se filtra en el cliente porque `path` vive en `categories`, no en la vista.
  const { data: children, error: catErr } = await supabase
    .from('categories')
    .select('id')
    .contains('path', [params.parentCategoryId])
    .neq('id', params.parentCategoryId);
  if (catErr) throw catErr;

  const childIds = (children ?? []).map((c: { id: string }) => c.id);
  if (childIds.length === 0) return [];

  const { data, error } = await supabase
    .from('v_budget_progress')
    .select('*')
    .eq('household_id', params.householdId)
    .eq('period_month', params.periodMonth)
    .in('category_id', childIds);

  if (error) throw error;
  return budgetProgressSchema.array().parse(data);
}
