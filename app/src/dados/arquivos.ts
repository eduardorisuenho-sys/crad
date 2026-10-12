/**
 * Fotos: primeiro a cópia guardada no aparelho; se não houver e tiver internet,
 * baixa do servidor (miniatura, ou a foto inteira) e guarda para a próxima vez.
 */
import type { BancoCrads } from './db';
import type { Sessao } from './sessao';

const tentadas = new Set<string>();

export async function fotoGuardadaOuBaixada(db: BancoCrads, sessao: Sessao | null, fotoId: string, colecao = 'foto'): Promise<Blob | undefined> {
  const local = await db._miniaturas.get(fotoId);
  if (local) return local.blob;
  if (!sessao || (typeof navigator !== 'undefined' && !navigator.onLine) || tentadas.has(fotoId)) return undefined;
  tentadas.add(fotoId);
  for (const campo of ['miniatura', 'arquivo']) {
    try {
      const r = await fetch(`${sessao.servidor.replace(/\/$/, '')}/api/crads/arquivo/${colecao}/${fotoId}/${campo}`, { headers: { authorization: sessao.token } });
      if (!r.ok) continue;
      const blob = await r.blob();
      await db._miniaturas.put({ id: fotoId, blob });
      return blob;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
