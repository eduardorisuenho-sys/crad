import { describe, expect, it } from 'vitest';
import {
  ajustesInventario,
  atrasado,
  bloqueioMudancaFase,
  bloqueioSaidaMudas,
  dataPrevistaPronta,
  disponivel,
  entradaPorContagem,
  proximasFases,
  saldoMudas,
  taxaGerminacao,
} from '../src/viveiro';

describe('germinação', () => {
  it('taxa real = emergidas ÷ semeadas', () => {
    expect(taxaGerminacao(200, 150)).toBe(75);
    expect(taxaGerminacao(300, 100)).toBe(33.3);
    expect(taxaGerminacao(0, 10)).toBeNull();
    expect(taxaGerminacao(100, null)).toBeNull();
  });

  it('contagem acumulada: entra no estoque só a diferença', () => {
    expect(entradaPorContagem(200, 0, 120)).toEqual({ entrada: 120 });
    expect(entradaPorContagem(200, 120, 150)).toEqual({ entrada: 30 });
    expect(entradaPorContagem(200, 150, 140)).toEqual({ erro: expect.stringMatching(/anterior foi 150/) });
    expect(entradaPorContagem(200, 0, 250)).toEqual({ erro: expect.stringMatching(/semeadas 200/) });
    expect(entradaPorContagem(200, 0, 1.5)).toEqual({ erro: expect.any(String) });
  });
});

describe('estoque de mudas', () => {
  const movs = [
    { tipo: 'entrada', quantidade: 120 },
    { tipo: 'entrada', quantidade: 30 },
    { tipo: 'perda', quantidade: 10 },
    { tipo: 'ajuste_inventario', quantidade: -5 },
    { tipo: 'saida_doacao', quantidade: 50 },
    { tipo: 'perda', quantidade: 99, excluido: true },
  ];
  it('saldo é a soma dos movimentos', () => {
    expect(saldoMudas(movs)).toBe(85);
  });
  it('disponível desconta as reservas', () => {
    expect(disponivel(85, [{ quantidade: 30 }, { quantidade: 20 }])).toBe(35);
    expect(disponivel(10, [{ quantidade: 30 }])).toBe(0);
  });
  it('perda maior que o saldo é bloqueada', () => {
    expect(bloqueioSaidaMudas(85, 90)).toBe('O lote tem 85 mudas.');
    expect(bloqueioSaidaMudas(85, 0)).toMatch(/inteiro/);
    expect(bloqueioSaidaMudas(85, 85)).toBeNull();
  });
});

describe('fases', () => {
  it('só avançam (pode pular)', () => {
    expect(proximasFases('germinacao')).toEqual(['repicagem', 'crescimento', 'rustificacao', 'pronta']);
    expect(bloqueioMudancaFase('crescimento', 'pronta')).toBeNull();
    expect(bloqueioMudancaFase('rustificacao', 'crescimento')).toMatch(/avançar/);
    expect(bloqueioMudancaFase('pronta', 'pronta')).toMatch(/avançar/);
  });

  it('data prevista e atraso', () => {
    expect(dataPrevistaPronta('2026-01-31', 6)).toBe('2026-07-31');
    expect(dataPrevistaPronta('2026-01-31', null)).toBeNull();
    expect(atrasado('2026-07-31', 'crescimento', '2026-08-01')).toBe(true);
    expect(atrasado('2026-07-31', 'pronta', '2026-08-01')).toBe(false);
  });
});

describe('inventário', () => {
  it('só as diferenças viram ajuste', () => {
    expect(
      ajustesInventario([
        { lote_mudas_id: 'a', saldo_sistema: 100, contado: 96 },
        { lote_mudas_id: 'b', saldo_sistema: 50, contado: 50 },
        { lote_mudas_id: 'c', saldo_sistema: 20, contado: null },
        { lote_mudas_id: 'd', saldo_sistema: 0, contado: 3 },
      ]),
    ).toEqual([
      { lote_mudas_id: 'a', diferenca: -4 },
      { lote_mudas_id: 'd', diferenca: 3 },
    ]);
  });
});
