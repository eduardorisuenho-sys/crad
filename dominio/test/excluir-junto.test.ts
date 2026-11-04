import { describe, expect, it } from 'vitest';
import { planoExclusao, resumoExclusao } from '../src/lixeira';

type Reg = Record<string, unknown> & { id: string };

function base(): Record<string, Reg[]> {
  return {
    matriz: [{ id: 'm1', codigo: 'MT-0021' }],
    coleta: [{ id: 'c1', matriz_id: 'm1', data: '2026-11-04' }],
    lote_sementes_coleta: [{ id: 'j1', coleta_id: 'c1', lote_sementes_id: 'ls1' }],
    lote_sementes: [{ id: 'ls1', codigo: 'LS-2026-012' }],
    movimento_sementes: [{ id: 'ms1', lote_sementes_id: 'ls1', tipo: 'entrada' }, { id: 'ms2', lote_sementes_id: 'ls1', lote_mudas_id: 'lm1', tipo: 'semeadura' }],
    lote_mudas: [{ id: 'lm1', codigo: 'LM-2026-012-A', lote_sementes_id: 'ls1' }],
    movimento_estoque_mudas: [{ id: 'me1', lote_mudas_id: 'lm1', tipo: 'entrada' }],
    fenologia: [{ id: 'f1', matriz_id: 'm1' }],
  };
}
const plano = (d: Record<string, Reg[]>, col = 'matriz', id = 'm1') =>
  planoExclusao(col, id, (c, campo, v) => (d[c] ?? []).filter((r) => r[campo] === v), (c, i) => (d[c] ?? []).find((r) => r.id === i));

describe('excluir com o que veio dele', () => {
  it('matriz leva a coleta, o lote de sementes e as mudas; o histórico vai escondido junto', () => {
    const p = plano(base());
    expect(p.bloqueios).toEqual([]);
    expect(p.apagar.map((a) => `${a.colecao}:${a.id}`)).toEqual(['lote_mudas:lm1', 'lote_sementes_coleta:j1', 'lote_sementes:ls1', 'coleta:c1', 'matriz:m1']);
    expect(resumoExclusao(p, 'matriz', 'm1')).toBe('1 lote de mudas (LM-2026-012-A), 1 lote de sementes (LS-2026-012) e 1 coleta (Coleta de 04/11/2026)');
  });

  it('o lote de sementes sozinho leva as mudas dele, mas não a coleta', () => {
    const p = plano(base(), 'lote_sementes', 'ls1');
    expect(p.apagar.map((a) => a.colecao)).toEqual(['lote_mudas', 'lote_sementes_coleta', 'lote_sementes']);
  });

  it('mudas reservadas para pedido aprovado ou já entregues numa doação impedem', () => {
    const d = base();
    d.reserva = [{ id: 'r1', lote_mudas_id: 'lm1', situacao: 'ativa' }];
    expect(plano(d).bloqueios.map((b) => b.colecao)).toEqual(['reserva']);
    const e = base();
    e.reserva = [{ id: 'r2', lote_mudas_id: 'lm1', situacao: 'cancelada' }];
    e.doacao_item_lote = [{ id: 'd1', lote_mudas_id: 'lm1', quantidade: 5 }];
    expect(plano(e).bloqueios.map((b) => b.colecao)).toEqual(['doacao_item_lote']);
  });

  it('lote de sementes que também tem sementes de outra matriz não some sem aviso', () => {
    const d = base();
    d.coleta.push({ id: 'c2', matriz_id: 'm2', data: '2026-11-01' });
    d.lote_sementes_coleta.push({ id: 'j2', coleta_id: 'c2', lote_sementes_id: 'ls1' });
    expect(plano(d).bloqueios).toEqual([{ colecao: 'lote_sementes', quantidade: 1, exemplos: ['LS-2026-012'] }]);
  });

  it('excluir o próprio lote com sementes de várias coletas: vai o lote, as coletas ficam', () => {
    const d = base();
    d.coleta.push({ id: 'c2', matriz_id: 'm2', data: '2026-11-01' });
    d.lote_sementes_coleta.push({ id: 'j2', coleta_id: 'c2', lote_sementes_id: 'ls1' });
    const p = plano(d, 'lote_sementes', 'ls1');
    expect(p.bloqueios).toEqual([]);
    expect(p.apagar.map((a) => a.colecao)).toEqual(['lote_mudas', 'lote_sementes_coleta', 'lote_sementes_coleta', 'lote_sementes']);
  });

  it('o que já está na lixeira não conta', () => {
    const d = base();
    d.coleta[0].excluido = true;
    expect(plano(d).apagar.map((a) => a.colecao)).toEqual(['matriz']);
  });
});
