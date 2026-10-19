import { describe, expect, it } from 'vitest';
import { dependentesAtivos, mensagemDependentes, ordemParaApagar } from '../src/lixeira';

type Reg = Record<string, unknown> & { id: string };
const banco = (dados: Record<string, Reg[]>) => (c: string, campo: string, v: string) => (dados[c] ?? []).filter((r) => r[campo] === v);

describe('apagar de vez: o que vai junto e o que bloqueia', () => {
  it('pedido leva junto a retirada (não bloqueia mais)', () => {
    const d = banco({ retirada: [{ id: 'r1', doacao_id: 'd1', data: '2026-10-16' }, { id: 'r2', doacao_id: 'd1' }], doacao_item: [{ id: 'i1', doacao_id: 'd1' }] });
    expect(dependentesAtivos('doacao', 'd1', d)).toEqual([]);
  });

  it('lote leva junto o inventário e as reservas já usadas; reserva ativa bloqueia', () => {
    const base = { inventario_item: [{ id: 'x', lote_mudas_id: 'l1' }], reserva: [{ id: 'r', lote_mudas_id: 'l1', situacao: 'consumida' }] };
    expect(dependentesAtivos('lote_mudas', 'l1', banco(base))).toEqual([]);
    const comAtiva = banco({ ...base, reserva: [...base.reserva, { id: 'ra', lote_mudas_id: 'l1', situacao: 'ativa' }] });
    expect(dependentesAtivos('lote_mudas', 'l1', comAtiva)).toMatchObject([{ colecao: 'reserva', quantidade: 1 }]);
  });

  it('a mensagem diz qual cadastro bloqueia', () => {
    const d = banco({ lote_mudas: [{ id: 'l9', especie_id: 'e1', codigo: 'LM-2026-I-007' }] });
    const deps = dependentesAtivos('especie', 'e1', d);
    expect(mensagemDependentes(deps)).toBe('Ainda há registros ligados a este: 1 em lote de mudas: LM-2026-I-007. Exclua ou corrija esses antes.');
  });

  it('vários de uma vez: pedidos antes dos lotes, lotes antes das espécies', () => {
    const ordem = ['especie', 'lote_mudas', 'doacao'].sort((a, b) => ordemParaApagar(a) - ordemParaApagar(b));
    expect(ordem).toEqual(['doacao', 'lote_mudas', 'especie']);
  });
});
