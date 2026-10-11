/** Consultas do Módulo 2 no banco do aparelho. */
import type { Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);

/** Nome popular (ou científico) de cada espécie. */
export async function nomesEspecies(db: BancoCrads): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const e of await db.colecao('especie').toArray()) m.set(e.id, String(e.nome_cientifico));
  const pop = new Set<string>();
  for (const n of ativos(await db.colecao('nome_popular').toArray())) {
    const id = String(n.especie_id);
    if (pop.has(id)) continue;
    pop.add(id);
    m.set(id, String(n.nome));
  }
  return m;
}

/** Coletas que já entraram em algum lote. */
export async function coletasEmLote(db: BancoCrads): Promise<Set<string>> {
  return new Set(ativos(await db.colecao('lote_sementes_coleta').toArray()).map((l) => String(l.coleta_id)));
}

/** Última fenologia de cada matriz (para a rota: quem está com fruto maduro). */
export async function ultimaFenologia(db: BancoCrads): Promise<Map<string, Registro>> {
  const m = new Map<string, Registro>();
  for (const f of ativos(await db.colecao('fenologia').toArray())) {
    const id = String(f.matriz_id);
    const atual = m.get(id);
    if (!atual || String(f.data) > String(atual.data)) m.set(id, f);
  }
  return m;
}
