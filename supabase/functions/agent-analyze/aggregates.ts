import type { SupabaseClient } from '@supabase/supabase-js';

export interface MonthlyAggregate {
  rootCategoryName: string;
  month: string; // YYYY-MM-01
  totalCents: number;
}

export interface TopMerchant {
  merchant: string;
  totalCents: number;
  count: number;
}

export interface BudgetVsActual {
  categoryName: string;
  budgetCents: number;
  spentCents: number;
}

/**
 * Se pasan agregados al modelo, nunca filas de `expenses` — plan §3.3. Todo se
 * calcula aquí en SQL/JS; la Edge Function no reenvía datos en crudo del usuario.
 */
export async function buildAggregates(
  admin: SupabaseClient,
  householdId: string,
  periodMonth: string,
) {
  const sixMonthsAgo = new Date(periodMonth);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const from = sixMonthsAgo.toISOString().slice(0, 7) + '-01';

  const { data: categories, error: categoriesError } = await admin
    .from('categories')
    .select('id, name, path')
    .eq('household_id', householdId);
  if (categoriesError) throw categoriesError;
  const catById = new Map(
    (categories ?? []).map((c: { id: string; name: string; path: string[] }) => [c.id, c]),
  );
  const rootNameFor = (categoryId: string | null): string => {
    if (!categoryId) return 'Sin categoría';
    const cat = catById.get(categoryId);
    if (!cat) return 'Sin categoría';
    const rootId = cat.path[0];
    return catById.get(rootId)?.name ?? cat.name;
  };

  const { data: expenses, error: expensesError } = await admin
    .from('expenses')
    .select('amount_cents, occurred_on, category_id, merchant')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .gte('occurred_on', from)
    .lt(
      'occurred_on',
      new Date(new Date(periodMonth).setMonth(new Date(periodMonth).getMonth() + 1))
        .toISOString()
        .slice(0, 10),
    );
  if (expensesError) throw expensesError;

  const monthly = new Map<string, number>();
  const merchants = new Map<string, { totalCents: number; count: number }>();

  for (const row of (expenses ?? []) as {
    amount_cents: number;
    occurred_on: string;
    category_id: string | null;
    merchant: string | null;
  }[]) {
    const month = row.occurred_on.slice(0, 7) + '-01';
    const rootName = rootNameFor(row.category_id);
    const key = `${rootName}|${month}`;
    monthly.set(key, (monthly.get(key) ?? 0) + row.amount_cents);

    if (row.merchant) {
      const m = merchants.get(row.merchant) ?? { totalCents: 0, count: 0 };
      m.totalCents += row.amount_cents;
      m.count += 1;
      merchants.set(row.merchant, m);
    }
  }

  const monthlyAggregates: MonthlyAggregate[] = [...monthly.entries()].map(([key, totalCents]) => {
    const [rootCategoryName, month] = key.split('|');
    return { rootCategoryName, month, totalCents };
  });

  const topMerchants: TopMerchant[] = [...merchants.entries()]
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .slice(0, 10)
    .map(([merchant, v]) => ({ merchant, ...v }));

  const { data: progress, error: progressError } = await admin
    .from('v_budget_progress')
    .select('category_id, amount_cents, spent_cents')
    .eq('household_id', householdId)
    .eq('period_month', periodMonth)
    .eq('is_top_level', true);
  if (progressError) throw progressError;

  const budgetVsActual: BudgetVsActual[] = (
    (progress ?? []) as { category_id: string; amount_cents: number; spent_cents: number }[]
  ).map((b) => ({
    categoryName: catById.get(b.category_id)?.name ?? b.category_id,
    budgetCents: b.amount_cents,
    spentCents: b.spent_cents,
  }));

  return { monthlyAggregates, topMerchants, budgetVsActual };
}
