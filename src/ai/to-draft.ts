import type { ParsedExpense, ParseExpenseResponse } from '@/domain/schemas/agent-contract';
import type { NewExpenseInput } from '@/domain/schemas/expense';
import { todayInMadrid } from '@/domain/civil-date';

/** Prefill de un formulario de gasto — nunca se guarda sin que el usuario confirme. */
export interface ExpenseDraft {
  amount_cents: number | null;
  occurred_on: string;
  category_id: string | null;
  merchant: string | null;
  note: string | null;
  custom: Record<string, unknown>;
  needsConfirmation: boolean;
  clarification: string | null;
}

const CONFIDENCE_THRESHOLD = 0.7;

function fromParsed(item: ParsedExpense): ExpenseDraft {
  return {
    amount_cents: item.amount_cents,
    occurred_on: item.occurred_on,
    category_id: item.category_id,
    merchant: item.merchant ?? null,
    note: item.note ?? null,
    custom: item.custom,
    needsConfirmation: item.confidence < CONFIDENCE_THRESHOLD,
    clarification: null,
  };
}

/** Mapea la respuesta del agente (éxito o fallo) a uno o varios borradores de formulario. */
export function responseToDrafts(response: ParseExpenseResponse): ExpenseDraft[] {
  if (!response.ok) {
    return [
      {
        amount_cents: response.prefill.amount_cents,
        occurred_on: response.prefill.occurred_on ?? todayInMadrid(),
        category_id: null,
        merchant: null,
        note: null,
        custom: {},
        needsConfirmation: true,
        clarification: null,
      },
    ];
  }

  if (response.draft.status !== 'ok' || response.draft.expenses.length === 0) {
    return [
      {
        amount_cents: null,
        occurred_on: todayInMadrid(),
        category_id: null,
        merchant: null,
        note: null,
        custom: {},
        needsConfirmation: true,
        clarification: response.draft.clarification ?? null,
      },
    ];
  }

  return response.draft.expenses.map(fromParsed);
}

export function draftToNewExpenseInput(
  draft: ExpenseDraft,
  ctx: { householdId: string; clientMutationId: string; runId?: string },
): NewExpenseInput | null {
  if (draft.amount_cents === null) return null;
  return {
    household_id: ctx.householdId,
    category_id: draft.category_id,
    amount_cents: draft.amount_cents,
    occurred_on: draft.occurred_on,
    merchant: draft.merchant,
    note: draft.note,
    custom: draft.custom,
    source: 'agent',
    agent_run_id: ctx.runId ?? null,
    client_mutation_id: ctx.clientMutationId,
  };
}
