import { describe, expect, it } from 'vitest';

import { modelOutputSchema, parseExpenseResponseSchema } from './agent-contract';

describe('modelOutputSchema', () => {
  it('acepta una salida ok con un gasto completo', () => {
    const result = modelOutputSchema.safeParse({
      status: 'ok',
      expenses: [
        {
          amount_cents: 4200,
          occurred_on: '2026-08-03',
          category_id: null,
          merchant: 'Mercadona',
          note: null,
          custom: {},
          confidence: 0.92,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza amount_cents no entero', () => {
    const result = modelOutputSchema.safeParse({
      status: 'ok',
      expenses: [
        {
          amount_cents: 42.5,
          occurred_on: '2026-08-03',
          category_id: null,
          merchant: null,
          note: null,
          confidence: 0.9,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza confidence fuera de [0,1]', () => {
    const result = modelOutputSchema.safeParse({
      status: 'ok',
      expenses: [
        {
          amount_cents: 100,
          occurred_on: '2026-08-03',
          category_id: null,
          merchant: null,
          note: null,
          confidence: 1.5,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza más de 5 gastos (límite del contrato)', () => {
    const expense = {
      amount_cents: 100,
      occurred_on: '2026-08-03',
      category_id: null,
      merchant: null,
      note: null,
      confidence: 0.9,
    };
    const result = modelOutputSchema.safeParse({
      status: 'ok',
      expenses: Array(6).fill(expense),
    });
    expect(result.success).toBe(false);
  });

  it('acepta not_an_expense con expenses vacío', () => {
    const result = modelOutputSchema.safeParse({ status: 'not_an_expense', expenses: [] });
    expect(result.success).toBe(true);
  });
});

describe('parseExpenseResponseSchema', () => {
  it('discrimina ok:true con draft', () => {
    const result = parseExpenseResponseSchema.safeParse({
      ok: true,
      run_id: '00000000-0000-0000-0000-000000000000',
      draft: { status: 'not_an_expense', expenses: [] },
    });
    expect(result.success).toBe(true);
  });

  it('discrimina ok:false con prefill y reason válido', () => {
    const result = parseExpenseResponseSchema.safeParse({
      ok: false,
      run_id: '00000000-0000-0000-0000-000000000000',
      reason: 'timeout',
      prefill: { amount_cents: 4200, occurred_on: '2026-08-03' },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza ok:false con un reason fuera del enum', () => {
    const result = parseExpenseResponseSchema.safeParse({
      ok: false,
      run_id: '00000000-0000-0000-0000-000000000000',
      reason: 'unknown_reason',
      prefill: { amount_cents: null, occurred_on: null },
    });
    expect(result.success).toBe(false);
  });
});
