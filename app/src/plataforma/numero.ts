/**
 * Números digitados no jeito brasileiro ("2,5") ou com ponto ("2.5").
 * Campos decimais usam type="text" + inputMode="decimal": o campo type="number"
 * recusa a vírgula em vários navegadores.
 */
export function lerNumero(texto: unknown): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const t = String(texto ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function mostrarNumero(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

/** Propriedades comuns dos campos decimais. */
export const CAMPO_DECIMAL = { type: 'text', inputMode: 'decimal', autoComplete: 'off', pattern: '-?[0-9]*[.,]?[0-9]*' } as const;
