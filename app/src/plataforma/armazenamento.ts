/** Pede ao navegador para não apagar os dados do app quando o aparelho estiver com pouco espaço. */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function espacoUsado(): Promise<{ usado: number; total: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage ?? 0, total: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

export function formatarBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
