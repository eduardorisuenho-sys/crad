import { expect, it } from 'vitest';
import { lerNumero } from '../src/plataforma/numero';

it('lê número com vírgula ou ponto', () => {
  expect(lerNumero('2,5')).toBe(2.5);
  expect(lerNumero(' 1.25 ')).toBe(1.25);
  expect(lerNumero('-5')).toBe(-5);
  expect(lerNumero('')).toBeNull();
  expect(lerNumero('abc')).toBeNull();
  expect(lerNumero(14)).toBe(14);
});
