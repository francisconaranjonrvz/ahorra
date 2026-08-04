import {
  analyzeRequestSchema,
  analyzeResponseSchema,
  type AnalyzeResponse,
} from '../../../src/domain/schemas/agent-contract.ts';
import { adminClient, callingUser } from '../_shared/clients.ts';
import { ANALYZE_MODEL, chatCompletion } from '../_shared/nvidia.ts';
import { isRateLimited } from '../_shared/throttle.ts';
import { buildAggregates } from './aggregates.ts';

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

async function digestOf(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SYSTEM_PROMPT = `Eres un analista financiero personal. Recibes agregados mensuales de gasto
(nunca transacciones individuales) de un household español y devuelves EXCLUSIVAMENTE un objeto
JSON que valide contra el esquema, en español, sin markdown.

Reglas:
- headline: una frase que resuma el mes en ≤120 caracteres.
- insights: como mucho 5, cada uno con evidencia real en los agregados recibidos. No inventes cifras.
- suggestions: sugerencias de ahorro accionables, no genéricas ("gasta menos" no vale).
- impact_cents / estimated_monthly_saving_cents: solo si puedes estimarlos a partir de los datos; si no, null.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  // Red de seguridad: cualquier excepción no prevista debe seguir devolviendo JSON
  // con cabeceras CORS — ver mismo patrón en agent-parse-expense/index.ts.
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
    input = analyzeRequestSchema.parse(await req.json());
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

  const aggregates = await buildAggregates(admin, input.household_id, input.period_month);
  const digest = await digestOf(JSON.stringify(aggregates));

  const { data: cached } = await admin
    .from('ai_insights')
    .select('payload, input_digest')
    .eq('household_id', input.household_id)
    .eq('period_month', input.period_month)
    .maybeSingle();

  if (cached && cached.input_digest === digest) {
    return json({ ok: true, cached: true, analysis: cached.payload });
  }

  if (await isRateLimited(admin, user.id)) {
    return json({ ok: false, reason: 'rate_limited' }, 429);
  }

  const startedAt = Date.now();
  try {
    const result = await chatCompletion({
      model: ANALYZE_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({ period_month: input.period_month, ...aggregates }),
      temperature: 0.3,
      // No es interactivo (bajo demanda + cacheado): tolera la latencia real observada
      // de modelos grandes en el free tier (11-20s) sin necesidad de ser rápido.
      timeoutMs: 25_000,
    });
    const analysis = analyzeResponseSchema.parse(
      JSON.parse(result.content),
    ) satisfies AnalyzeResponse;

    await admin.from('ai_insights').upsert(
      {
        household_id: input.household_id,
        period_month: input.period_month,
        payload: analysis,
        input_digest: digest,
      },
      { onConflict: 'household_id,period_month' },
    );

    await admin.from('agent_runs').insert({
      household_id: input.household_id,
      user_id: user.id,
      kind: 'analyze',
      model: ANALYZE_MODEL,
      status: 'ok',
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      latency_ms: result.latencyMs,
    });

    return json({ ok: true, cached: false, analysis });
  } catch (err) {
    await admin.from('agent_runs').insert({
      household_id: input.household_id,
      user_id: user.id,
      kind: 'analyze',
      model: ANALYZE_MODEL,
      status: 'provider_error',
      latency_ms: Date.now() - startedAt,
      raw_output: String(err),
    });
    return json({ ok: false, reason: 'provider_error' }, 502);
  }
}
