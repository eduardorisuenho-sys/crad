import { describe, expect, it } from 'vitest';
import { dataCarimbo } from '../src/componentes/Miniatura';

describe('carimbo de data das fotos', () => {
  it('mostra dd/mm/aaaa para data com hora, só data ou formato do servidor', () => {
    expect(dataCarimbo('2026-05-02T10:00:00')).toBe('02/05/2026');
    expect(dataCarimbo('2026-05-02')).toBe('02/05/2026');
    expect(dataCarimbo('2026-05-02 10:00:00.000Z')).toMatch(/0[12]\/05\/2026/);
  });
  it('sem data válida não mostra nada', () => {
    expect(dataCarimbo('')).toBe('');
    expect(dataCarimbo(undefined)).toBe('');
    expect(dataCarimbo('xyz')).toBe('');
  });
});
