import { z } from 'zod';

import {
  modelOutputSchema,
  parseExpenseRequestSchema,
  type ParseExpenseResponse,
} from '../../../src/domain/schemas/agent-contract.ts';
import { adminClient, callingUser } from '../_shared/clients.ts';
import { extractAmountCents, extractOccurredOn } from '../_shared/heuristic-extract.ts';
import {
  chatCompletion,
  NvidiaProviderError,
  NvidiaTimeoutError,
  PARSE_MODEL,
} from '../_shared/nvidia.ts';
import { isRateLimited } from '../_shared/throttle.ts';
import { buildSystemPrompt, OUTPUT_JSON_SCHEMA } from './prompt.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function logRun(
  admin: ReturnType<typeof adminClient>,
  fields: {
    household_id: string;
    user_id: string;
    status: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms?: number;
    raw_output?: string;
  },
): Promise<string> {
  const { data, error } = await admin
    .from('agent_runs')
    .insert({ kind: 'parse_expense', model: PARSE_MODEL, ...fields })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

function providerErrorResponse(
  runId: string,
  text: string,
  clientToday: string,
): ParseExpenseResponse {
  return {
    ok: false,
    run_id: runId,
    reason: 'provider_error',
    prefill: {
      amount_cents: extractAmountCents(text),
      occurred_on: extractOccurredOn(text, clientToday),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  // Red de seguridad: cualquier excepción no prevista (red, DB, etc.) debe seguir
  // devolviendo JSON con cabeceras CORS — un throw sin capturar aquí rompe el fetch
  // del cliente por CORS, no solo el caso de negocio que falló.
  try {
    return await handleRequest(req);
  } catch (err) {
    return json({ error: 'internal_error', detail: String(err) }, 500);
  }
});

async function handleRequest(req: Request): Promise<Response> {
  const user = await callingUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let input;
  try {
    input = parseExpenseRequestSchema.parse(await req.json());
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const admin = adminClient();

  const { data: membership } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', input.household_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return json({ error: 'forbidden' }, 403);

  if (await isRateLimited(admin, user.id)) {
    const runId = await logRun(admin, {
      household_id: input.household_id,
      user_id: user.id,
      status: 'rate_limited',
    });
    return json({
      ok: false,
      run_id: runId,
      reason: 'rate_limited',
      prefill: { amount_cents: null, occurred_on: null },
    } satisfies ParseExpenseResponse);
  }

  const [
    { data: categories, error: categoriesError },
    { data: customFields, error: customFieldsError },
    { data: recentExpenses, error: recentExpensesError },
  ] = await Promise.all([
    admin
      .from('categories')
      .select('id, path, name')
      .eq('household_id', input.household_id)
      .eq('is_archived', false),
    admin
      .from('custom_field_defs')
      .select('key, label, type')
      .eq('household_id', input.household_id)
      .eq('is_archived', false),
    admin
      .from('expenses')
      .select('merchant')
      .eq('household_id', input.household_id)
      .is('deleted_at', null)
      .not('merchant', 'is', null)
      .gte('occurred_on', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
      .limit(200),
  ]);

  const contextError = categoriesError ?? customFieldsError ?? recentExpensesError;
  if (contextError) {
    const runId = await logRun(admin, {
      household_id: input.household_id,
      user_id: user.id,
      status: 'provider_error',
      raw_output: `context query failed: ${contextError.message}`,
    });
    return json(providerErrorResponse(runId, input.text, input.client_today));
  }

  const nameById = new Map(
    (categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  );
  const categoryContext = (categories ?? []).map((c: { id: string; path: string[] }) => ({
    id: c.id,
    readablePath: c.path
      .map((id: string) => nameById.get(id))
      .filter(Boolean)
      .join(' › '),
  }));
  const validCategoryIds = new Set(categoryContext.map((c) => c.id));

  const merchantCounts = new Map<string, number>();
  for (const row of (recentExpenses ?? []) as { merchant: string | null }[]) {
    if (!row.merchant) continue;
    merchantCounts.set(row.merchant, (merchantCounts.get(row.merchant) ?? 0) + 1);
  }
  const topMerchants = [...merchantCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([m]) => m);

  const systemPrompt = buildSystemPrompt({
    clientToday: input.client_today,
    categories: categoryContext,
    customFields: (customFields ?? []) as { key: string; label: string; type: string }[],
    merchants: topMerchants,
  });

  async function attempt(extraUserContext?: string) {
    const result = await chatCompletion({
      model: PARSE_MODEL,
      systemPrompt,
      userPrompt: extraUserContext ? `${input!.text}\n\n${extraUserContext}` : input!.text,
      jsonSchema: OUTPUT_JSON_SCHEMA,
      temperature: extraUserContext ? 0 : 0.2,
    });
    const parsed = modelOutputSchema.parse(JSON.parse(result.content));
    return { parsed, result };
  }

  try {
    let outcome;
    let status: 'ok' | 'repaired' = 'ok';
    try {
      outcome = await attempt();
    } catch (firstErr) {
      if (firstErr instanceof NvidiaTimeoutError || firstErr instanceof NvidiaProviderError)
        throw firstErr;
      // JSON no parseable o zod falla ⇒ 1 reintento reparador (fila 2 de la escalera).
      const detail =
        firstErr instanceof z.ZodError ? JSON.stringify(firstErr.issues) : String(firstErr);
      outcome = await attempt(
        `Tu respuesta anterior no era JSON válido según el esquema. Error: ${detail}. Repite SOLO el JSON correcto.`,
      );
      status = 'repaired';
    }

    // Filas 4-5 de la escalera: nunca confiar en category_id/occurred_on sin verificar.
    const today = new Date(input.client_today);
    const minDate = new Date(today);
    minDate.setFullYear(minDate.getFullYear() - 2);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);

    outcome.parsed.expenses = outcome.parsed.expenses.map((expense) => {
      let e = expense;
      if (e.category_id && !validCategoryIds.has(e.category_id)) {
        e = { ...e, category_id: null };
      }
      const occurred = new Date(e.occurred_on);
      if (occurred < minDate || occurred > maxDate) {
        e = { ...e, occurred_on: input.client_today, confidence: e.confidence * 0.5 };
      }
      return e;
    });

    const runId = await logRun(admin, {
      household_id: input.household_id,
      user_id: user.id,
      status,
      prompt_tokens: outcome.result.promptTokens,
      completion_tokens: outcome.result.completionTokens,
      latency_ms: outcome.result.latencyMs,
      ...(status !== 'ok' ? { raw_output: outcome.result.content } : {}),
    });

    return json({ ok: true, run_id: runId, draft: outcome.parsed } satisfies ParseExpenseResponse);
  } catch (err) {
    const reason = err instanceof NvidiaTimeoutError ? 'timeout' : 'provider_error';
    const runId = await logRun(admin, {
      household_id: input.household_id,
      user_id: user.id,
      status: reason,
      raw_output: String(err),
    });
    return json(providerErrorResponse(runId, input.text, input.client_today));
  }
}
