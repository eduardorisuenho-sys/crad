/** Consultas do Módulo 3 no banco do aparelho. */
import { saldoMudas, saldoSementes, type Registro } from '@crads/dominio';
import type { Repositorio } from '../../dados/repositorio';

export const ROTULO_FASE: Record<string, string> = {
  semeadura: 'Semeadura',
  germinacao: 'Germinação',
  repicagem: 'Repicagem',
  crescimento: 'Crescimento',
  rustificacao: 'Rustificação',
  pronta: 'Pronta',
};
export const RECIPIENTES = [
  { valor: 'tubete', rotulo: 'Tubete' },
  { valor: 'saquinho', rotulo: 'Saquinho' },
  { valor: 'sementeira', rotulo: 'Sementeira' },
  { valor: 'outros', rotulo: 'Outros' },
];

export interface LoteMudasResumo {
  lote: Registro;
  saldo: number;
  germinadas: number;
}

/** Lotes de mudas do viveiro atual com saldo e última contagem de germinação. */
export async function lotesDeMudas(repo: Repositorio): Promise<LoteMudasResumo[]> {
  const [lotes, movs, eventos] = await Promise.all([repo.listar('lote_mudas'), repo.listar('movimento_estoque_mudas'), repo.listar('evento_lote_mudas', (e) => e.tipo === 'contagem_germinacao')]);
  const porLoteMov = agrupar(movs, 'lote_mudas_id');
  const porLoteEv = agrupar(eventos, 'lote_mudas_id');
  return lotes
    .map((lote) => ({
      lote,
      saldo: saldoMudas((porLoteMov.get(lote.id) ?? []) as never),
      germinadas: Math.max(0, ...(porLoteEv.get(lote.id) ?? []).map((e) => Number(e.quantidade ?? 0))),
    }))
    .sort((a, b) => String(b.lote.codigo).localeCompare(String(a.lote.codigo)));
}

/** Lotes de sementes com saldo (para semear). */
export async function lotesSementesComSaldo(repo: Repositorio): Promise<{ lote: Registro; g: number; unid: number }[]> {
  const [lotes, movs] = await Promise.all([repo.listar('lote_sementes'), repo.listar('movimento_sementes')]);
  const porLote = agrupar(movs, 'lote_sementes_id');
  return lotes
    .map((lote) => ({ lote, ...saldoSementes((porLote.get(lote.id) ?? []) as never) }))
    .filter((l) => l.g > 0 || l.unid > 0)
    .sort((a, b) => String(a.lote.validade ?? '9999').localeCompare(String(b.lote.validade ?? '9999')));
}

function agrupar(rs: Registro[], campo: string): Map<string, Registro[]> {
  const m = new Map<string, Registro[]>();
  for (const r of rs) {
    const k = String(r[campo]);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}
