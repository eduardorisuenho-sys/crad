import { expect, it } from 'vitest';
import { gerarId, idValido } from '../src/ids';

it('gera ids de 15 caracteres no formato do PocketBase, sem repetir', () => {
  const ids = new Set(Array.from({ length: 2000 }, gerarId));
  expect(ids.size).toBe(2000);
  for (const id of ids) expect(idValido(id)).toBe(true);
});
