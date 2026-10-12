import { describe, expect, it } from 'vitest';
import { servicoColetor } from '../src/servico-coletor';

const V = 'v1';
const d = {
  matrizes: [
    { id: 'm1', codigo: 'MT-0001', especie_id: 'e1', coletor_id: 'joao', criado_no_aparelho_em: '2026-10-02T10:00:00Z', viveiro_id: V },
    { id: 'm2', codigo: 'MT-0002', especie_id: 'e2', criado_por: 'joao', criado_no_aparelho_em: '2026-10-05T10:00:00Z', viveiro_id: V },
    { id: 'm3', codigo: 'MT-0003', especie_id: 'e1', coletor_id: 'maria', criado_no_aparelho_em: '2026-10-05T10:00:00Z', viveiro_id: V },
    { id: 'm4', codigo: 'MT-0004', especie_id: 'e1', coletor_id: 'joao', criado_no_aparelho_em: '2026-09-30T10:00:00Z', viveiro_id: V },
    { id: 'm5', codigo: 'MT-0005', especie_id: 'e3', coletor_id: 'joao', criado_no_aparelho_em: '2026-10-06T10:00:00Z', viveiro_id: V, excluido: true },
  ],
  coletas: [
    { id: 'c1', matriz_id: 'm4', data: '2026-10-05', quantidade: 2, unidade: 'kg', coletor_id: 'joao', viveiro_id: V },
    { id: 'c2', matriz_id: 'm1', data: '2026-10-07', quantidade: 500, unidade: 'g', coletor_id: 'joao', viveiro_id: V },
    { id: 'c3', matriz_id: 'm1', data: '2026-10-07', quantidade: 30, unidade: 'frutos', coletor_id: 'joao', viveiro_id: V },
    { id: 'c4', matriz_id: 'm3', data: '2026-10-07', quantidade: 9, unidade: 'kg', coletor_id: 'maria', viveiro_id: V },
  ],
  fenologias: [{ id: 'f1', matriz_id: 'm1', data: '2026-10-09', fases: ['flor'], criado_por: 'joao', viveiro_id: V }],
  fotos: [
    { id: 'p1', entidade: 'matriz', registro_id: 'm1', parte: 'folha' },
    { id: 'p2', entidade: 'matriz', registro_id: 'm1', parte: 'arvore' },
    { id: 'p3', entidade: 'matriz', registro_id: 'm3', parte: 'arvore' },
  ],
};

describe('relatório de serviço do coletor', () => {
  it('junta só o que a pessoa fez no período', () => {
    const r = servicoColetor(d, { coletorId: 'joao', inicio: '2026-10-01', fim: '2026-10-31' });
    expect(r.matrizes.map((m) => m.codigo)).toEqual(['MT-0001', 'MT-0002']);
    expect(r.coletas.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(r.fotosPorMatriz.get('m1')!.map((f) => f.parte)).toEqual(['arvore', 'folha']);
    expect(r.totais).toEqual({ matrizes: 2, coletas: 3, especies: 2, quilos: 2.5, outras_unidades: { frutos: 30 }, registros_flor_fruto: 1, dias_de_campo: 4 });
  });
});
