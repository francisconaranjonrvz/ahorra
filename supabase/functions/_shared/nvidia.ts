// Cliente mínimo para NVIDIA Build (API compatible OpenAI). La API key vive solo
// aquí — en Deno.env, nunca en el bundle del cliente.

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Dos modelos, elegidos por benchmark real contra 5 frases en español (ver sesión de
 * bootstrap): en el free tier compartido de NVIDIA Build, los modelos grandes con
 * `response_format: json_schema` tardan 11-20s y a menudo exceden 20s (solo 2-3 de 5
 * intentos respondieron dentro de ese margen). El 8B respondió 5/5 en <4s.
 *
 * - PARSE_MODEL: usado por agent-parse-expense, que es interactivo (el usuario escribe
 *   una frase y espera el borrador). Necesita latencia baja y consistente por encima de
 *   razonamiento superior; los errores de fecha relativa que comete ("el martes pasado"
 *   con año equivocado) ya los corrige la escalera de errores del contrato (occurred_on
 *   fuera de [hoy-2años, hoy+7días] ⇒ se fuerza a hoy, confidence *= 0.5).
 * - ANALYZE_MODEL: usado por agent-analyze, que corre bajo demanda y se cachea por mes
 *   (nunca en el camino crítico de una interacción). Aquí compensa pagar más latencia
 *   a cambio de mejor calidad de razonamiento sobre los agregados.
 */
export const PARSE_MODEL = 'meta/llama-3.1-8b-instruct';
export const ANALYZE_MODEL = 'meta/llama-3.3-70b-instruct';

const DEFAULT_TIMEOUT_MS = 12_000;

export class NvidiaTimeoutError extends Error {}
export class NvidiaProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface NvidiaChatOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}

export interface NvidiaChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export async function chatCompletion(opts: NvidiaChatOptions): Promise<NvidiaChatResult> {
  const apiKey = Deno.env.get('NVIDIA_API_KEY');
  if (!apiKey) throw new Error('NVIDIA_API_KEY no configurada');

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.2,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
        // Verificado empíricamente (ver comentario arriba): json_schema funciona y el
        // modelo respeta additionalProperties/required. Si algún día se cambia a un
        // modelo/backend que lo ignore, degrada a "cualquier JSON válido", que la
        // validación zod server-side sigue exigiendo igualmente.
        response_format: opts.jsonSchema
          ? { type: 'json_schema', json_schema: { name: 'ahorra_agent', schema: opts.jsonSchema } }
          : { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NvidiaProviderError(`NVIDIA Build respondió ${response.status}`, response.status);
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new NvidiaProviderError('Respuesta sin contenido de texto', response.status);
    }

    return {
      content,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NvidiaTimeoutError(`Timeout tras ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
