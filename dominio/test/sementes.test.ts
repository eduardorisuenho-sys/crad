import { describe, expect, it } from 'vitest';
import { bloqueioSaida, codigoEndereco, emGramas, saldoSementes, situacaoValidade, verificarLote } from '../src/sementes';

const matrizes = new Map([
  ['m1', { id: 'm1', codigo: 'MT-0001', especie_id: 'ipe', situacao_validacao: 'aprovada' }],
  ['m2', { id: 'm2', codigo: 'MT-0002', especie_id: 'ipe', situacao_validacao: 'aprovada' }],
  ['m3', { id: 'm3', codigo: 'MT-0003', especie_id: 'ipe', situacao: 'morta' }],
  ['m4', { id: 'm4', codigo: 'MT-0004', especie_id: 'baru', situacao_validacao: 'aprovada' }],
]);

describe('formação do lote de sementes', () => {
  it('lote com poucas matrizes passa, mas com alerta de diversidade', () => {
    const v = verificarLote('ipe', [{ id: 'c1', matriz_id: 'm1' }, { id: 'c2', matriz_id: 'm2' }, { id: 'c3', matriz_id: 'm1' }], matrizes, new Set(), 12);
    expect(v.bloqueios).toEqual([]);
    expect(v.matrizes).toBe(2);
    expect(v.alertas[0]).toMatch(/2 matriz\(es\).*pelo menos 12/);
    expect(verificarLote('ipe', [{ id: 'c1', matriz_id: 'm1' }, { id: 'c2', matriz_id: 'm2' }], matrizes, new Set(), 2).alertas).toEqual([]);
  });

  it('matriz pendente pode ser usada; bloqueia matriz morta, outra espécie e coleta já usada', () => {
    const v = verificarLote('ipe', [{ id: 'c3', matriz_id: 'm3' }, { id: 'c4', matriz_id: 'm4' }, { id: 'c1', matriz_id: 'm1' }], matrizes, new Set(['c1']), 1);
    expect(v.bloqueios).toEqual([
      'A matriz MT-0003 está morta, inativa ou foi excluída.',
      'A matriz MT-0004 é de outra espécie: um lote tem uma espécie só.',
      'A coleta da matriz MT-0001 já está em outro lote.',
    ]);
  });

  it('matriz recém-cadastrada (sem aprovação) já entra no lote', () => {
    const m = new Map([['m5', { id: 'm5', codigo: 'MT-0005', especie_id: 'ipe', situacao_validacao: 'pendente' }]]);
    expect(verificarLote('ipe', [{ id: 'c5', matriz_id: 'm5' }], m, new Set(), 1).bloqueios).toEqual([]);
  });

  it('bloqueia lote vazio ou sem espécie', () => {
    expect(verificarLote(undefined, [], matrizes, new Set(), 1).bloqueios).toEqual(['Escolha a espécie do lote.', 'Escolha pelo menos uma coleta.']);
  });
});

describe('estoque de sementes', () => {
  const movs = [
    { tipo: 'entrada', quantidade_g: 1000, quantidade_unid: 5000 },
    { tipo: 'teste', quantidade_g: 20, quantidade_unid: 100 },
    { tipo: 'semeadura', quantidade_g: 300, quantidade_unid: 1500 },
    { tipo: 'ajuste', quantidade_g: -5 },
    { tipo: 'mudanca_endereco' },
    { tipo: 'descarte', quantidade_g: 100, excluido: true },
  ];
  it('saldo é a soma dos movimentos', () => {
    expect(saldoSementes(movs)).toEqual({ g: 675, unid: 3400 });
  });

  it('lote sem contagem de sementes: nunca mostra número negativo e não bloqueia pela contagem', () => {
    const semContagem = [
      { tipo: 'entrada', quantidade_g: 30 },
      { tipo: 'semeadura', quantidade_g: 0, quantidade_unid: 30 },
    ];
    const saldo = saldoSementes(semContagem);
    expect(saldo).toEqual({ g: 30, unid: 0 });
    expect(bloqueioSaida(saldo, { unid: 30 })).toBeNull();
    expect(bloqueioSaida(saldo, { g: 31 })).toMatch(/Só há 30 g/);
    expect(bloqueioSaida({ g: 10, unid: 5 }, { unid: 6 })).toMatch(/Só há 5 sementes/);
  });
  it('saída maior que o saldo é bloqueada', () => {
    expect(bloqueioSaida({ g: 675, unid: 3400 }, { g: 700 })).toBe('Só há 675 g neste lote.');
    expect(bloqueioSaida({ g: 675, unid: 3400 }, { g: 675 })).toBeNull();
  });
  it('converte para gramas quando dá', () => {
    expect(emGramas(1.5, 'kg')).toBe(1500);
    expect(emGramas(30, 'frutos')).toBeNull();
  });
});

describe('armazenamento', () => {
  it('endereço legível', () => {
    expect(codigoEndereco('PAL', { local: 'Câmara fria 1', estante: '2', prateleira: '3', caixa: '4' })).toBe('PAL-CAMARAFRIA1-E2-P3-CX4');
    expect(codigoEndereco('gur', { local: 'Sala seca' })).toBe('GUR-SALASECA');
  });
  it('validade', () => {
    expect(situacaoValidade('2026-10-01', '2026-10-11', 60)).toBe('vencido');
    expect(situacaoValidade('2026-11-01', '2026-10-11', 60)).toBe('vence_logo');
    expect(situacaoValidade('2027-10-01', '2026-10-11', 60)).toBe('ok');
    expect(situacaoValidade(null, '2026-10-11', 60)).toBe('sem_validade');
  });
});
