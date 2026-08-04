/** Céntimos de euro. Nunca float — ver invariante del proyecto. */
export type Cents = number & { readonly __brand: 'Cents' };

export function toCents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`toCents recibió un valor no entero: ${value}`);
  }
  return value as Cents;
}

export function addCents(a: Cents, b: Cents): Cents {
  return toCents(a + b);
}

export function centsFromEuroString(input: string): Cents | null {
  const normalized = input.trim().replace(/[€\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const euros = Number.parseFloat(normalized);
  return toCents(Math.round(euros * 100));
}

export function formatCentsEs(cents: Cents): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
