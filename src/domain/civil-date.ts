import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

const MADRID = 'Europe/Madrid';

/** YYYY-MM-DD — fecha civil sin zona, como se guarda en `expenses.occurred_on`. */
export type CivilDate = string & { readonly __brand: 'CivilDate' };

export function todayInMadrid(): CivilDate {
  return format(new TZDate(new Date(), MADRID), 'yyyy-MM-dd') as CivilDate;
}

export function toCivilDate(date: Date): CivilDate {
  return format(new TZDate(date, MADRID), 'yyyy-MM-dd') as CivilDate;
}

export function startOfMonthCivil(civilDate: CivilDate): CivilDate {
  return `${civilDate.slice(0, 7)}-01` as CivilDate;
}

export function isValidCivilDate(value: string): value is CivilDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatCivilDateEs(civilDate: CivilDate): string {
  const [y, m, d] = civilDate.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}
