// Extracción de respaldo cuando el proveedor falla (timeout/5xx/429) — plan §3.2 fila 1.
// No pretende ser inteligente: solo evita un formulario completamente vacío.

const AMOUNT_RE = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros?)/i;

export function extractAmountCents(text: string): number | null {
  const match = text.match(AMOUNT_RE);
  if (!match) return null;
  const normalized = match[1].replace(',', '.');
  return Math.round(Number.parseFloat(normalized) * 100);
}

export function extractOccurredOn(text: string, todayIso: string): string | null {
  const lower = text.toLowerCase();
  if (/\bhoy\b/.test(lower)) return todayIso;
  if (/\bayer\b/.test(lower)) {
    const d = new Date(`${todayIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  // Sin más heurística: fechas relativas complejas ("el martes pasado") se dejan al modelo;
  // aquí solo cubrimos los dos casos más frecuentes para no dejar el campo vacío.
  return null;
}
