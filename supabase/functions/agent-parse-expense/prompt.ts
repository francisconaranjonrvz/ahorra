interface CategoryContext {
  id: string;
  readablePath: string; // "Alimentación › Supermercado"
}

interface CustomFieldContext {
  key: string;
  label: string;
  type: string;
}

export function buildSystemPrompt(ctx: {
  clientToday: string;
  categories: CategoryContext[];
  customFields: CustomFieldContext[];
  merchants: string[];
}): string {
  const tree = ctx.categories.map((c) => `- ${c.id}: ${c.readablePath}`).join('\n');
  const customDefs =
    ctx.customFields.map((f) => `- ${f.key} (${f.type}): ${f.label}`).join('\n') || '(ninguno)';
  const merchants = ctx.merchants.join(', ') || '(ninguno registrado aún)';

  return `Eres un extractor de gastos. Conviertes texto en español de España a JSON estructurado.
Devuelves EXCLUSIVAMENTE un objeto JSON que valide contra el esquema. Sin markdown, sin explicación.

Reglas:
- amount_cents: entero de céntimos. "42 euros"→4200, "42,50"→4250, "42 pavos"→4200. Nunca decimales.
- occurred_on: YYYY-MM-DD. Hoy es ${ctx.clientToday} (Europe/Madrid). Resuelve "ayer",
  "el martes pasado", "el 3". Sin fecha explícita ⇒ ${ctx.clientToday}.
- category_id: SOLO un id de la lista. Si ninguna encaja con claridad, null. No inventes ids.
- merchant: nombre propio del comercio, sin artículo ("el Mercadona"→"Mercadona").
- Varios gastos en una frase ⇒ varios elementos. Máximo 5.
- confidence: tu certeza real sobre el conjunto del elemento, 0-1. Sé conservador.
- Si el texto no describe ningún gasto ⇒ status="not_an_expense", expenses=[].
- Si falta el importe o es ambiguo ⇒ status="ambiguous" y rellena "clarification"
  con UNA pregunta corta en español.

Categorías:
${tree}

Campos personalizados:
${customDefs}

Comercios frecuentes: ${merchants}`;
}

export const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'expenses'],
  properties: {
    status: { enum: ['ok', 'ambiguous', 'not_an_expense'] },
    clarification: { type: ['string', 'null'], maxLength: 200 },
    expenses: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amount_cents', 'occurred_on', 'category_id', 'confidence'],
        properties: {
          amount_cents: { type: 'integer', minimum: 1, maximum: 100_000_000 },
          occurred_on: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          category_id: { type: ['string', 'null'] },
          merchant: { type: ['string', 'null'], maxLength: 120 },
          note: { type: ['string', 'null'], maxLength: 500 },
          custom: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;
