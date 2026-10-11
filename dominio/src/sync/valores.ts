/**
 * Comparação de valores tolerante às diferenças entre aparelho e servidor:
 * o PocketBase guarda texto vazio como "", número vazio como 0 e booleano
 * vazio como false, enquanto o aparelho pode ter null/undefined.
 */
export function vazio(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === 0 || v === false || (Array.isArray(v) && v.length === 0);
}

export function iguais(a: unknown, b: unknown): boolean {
  if (vazio(a) && vazio(b)) return true;
  if (a === b) return true;
  if (typeof a === 'object' && typeof b === 'object' && a && b) return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
  return false;
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) o[k] = ordenar((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}
