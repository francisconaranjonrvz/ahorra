import { describe, expect, it } from 'vitest';

import {
  formatCivilDateEs,
  isValidCivilDate,
  startOfMonthCivil,
  toCivilDate,
  type CivilDate,
} from './civil-date';

describe('toCivilDate', () => {
  it('usa el día civil de Madrid, no el de UTC (invierno, CET = UTC+1)', () => {
    // 2025-12-31T23:30Z = 2026-01-01T00:30 en Madrid — un slice ingenuo de UTC daría 31 dic.
    const instant = new Date(Date.UTC(2025, 11, 31, 23, 30));
    expect(toCivilDate(instant)).toBe('2026-01-01');
  });

  it('usa el día civil de Madrid en horario de verano (CEST = UTC+2)', () => {
    // 2026-07-01T22:30Z = 2026-07-02T00:30 en Madrid.
    const instant = new Date(Date.UTC(2026, 6, 1, 22, 30));
    expect(toCivilDate(instant)).toBe('2026-07-02');
  });
});

describe('startOfMonthCivil', () => {
  it('trunca al día 1 del mismo mes', () => {
    expect(startOfMonthCivil('2026-08-17' as CivilDate)).toBe('2026-08-01');
  });
});

describe('isValidCivilDate', () => {
  it('acepta YYYY-MM-DD', () => {
    expect(isValidCivilDate('2026-08-17')).toBe(true);
  });

  it('rechaza timestamps con hora', () => {
    expect(isValidCivilDate('2026-08-17T00:00:00Z')).toBe(false);
  });

  it('rechaza formato no numérico', () => {
    expect(isValidCivilDate('ayer')).toBe(false);
  });
});

describe('formatCivilDateEs', () => {
  it('formatea en es-ES sin desplazar el día', () => {
    const formatted = formatCivilDateEs('2026-08-17' as CivilDate);
    expect(formatted).toContain('17');
    expect(formatted).toContain('2026');
  });
});
