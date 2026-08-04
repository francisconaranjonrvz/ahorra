import { describe, expect, it } from 'vitest';

import { addCents, centsFromEuroString, formatCentsEs, toCents } from './money';

describe('centsFromEuroString', () => {
  it('parsea coma decimal española', () => {
    expect(centsFromEuroString('42,50')).toBe(4250);
  });

  it('parsea punto decimal', () => {
    expect(centsFromEuroString('42.50')).toBe(4250);
  });

  it('parsea el símbolo €', () => {
    expect(centsFromEuroString('42,50 €')).toBe(4250);
  });

  it('rechaza texto no numérico', () => {
    expect(centsFromEuroString('abc')).toBeNull();
  });

  it('rechaza más de 2 decimales', () => {
    expect(centsFromEuroString('42,555')).toBeNull();
  });
});

describe('formatCentsEs', () => {
  it('formatea en es-ES con símbolo €', () => {
    expect(formatCentsEs(toCents(4250))).toBe('42,50 €');
  });
});

describe('addCents', () => {
  it('suma sin perder precisión', () => {
    expect(addCents(toCents(100), toCents(250))).toBe(350);
  });
});

describe('toCents', () => {
  it('rechaza no enteros', () => {
    expect(() => toCents(42.5)).toThrow();
  });
});
