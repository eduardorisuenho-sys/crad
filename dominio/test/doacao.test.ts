import { describe, expect, it } from 'vitest';
import {
  bloqueioDesmarcar,
  bloqueioRetirada,
  bloqueiosPedido,
  marcadaNoPrograma,
  planejarReservas,
  planejarRetirada,
  podeAprovar,
  prazoRetirada,
  reservaAtiva,
  situacaoAposAnalise,
  totaisDoacoes,
} from '../src/doacao';
import { disponivelPorLote } from '../src/catalogo';

describe('pedido', () => {
  const disp = new Map([
    ['ipe', 100],
    ['baru', 10],
  ]);
  it('bloqueia acima do disponível e do limite por pedido', () => {
    expect(bloqueiosPedido([{ especie_id: 'ipe', quantidade: 50 }], disp, 1000)).toEqual([]);
    expect(bloqueiosPedido([{ especie_id: 'baru', quantidade: 20 }], disp, 1000, new Map([['baru', 'Baru']]))).toEqual(['Há 10 mudas de Baru disponíveis.']);
    expect(bloqueiosPedido([{ especie_id: 'ipe', quantidade: 80 }, { especie_id: 'baru', quantidade: 10 }], disp, 60)).toEqual(['O limite é de 60 mudas por pedido (este tem 90).']);
    expect(bloqueiosPedido([], disp, 60)).toEqual(['Escolha pelo menos uma espécie.']);
  });
});

describe('análise e reservas', () => {
  const lotes = [
    { id: 'novo', especie_id: 'ipe', data_semeadura: '2026-05-01', disponivel: 100 },
    { id: 'velho', especie_id: 'ipe', data_semeadura: '2026-01-01', disponivel: 30 },
    { id: 'baru1', especie_id: 'baru', data_semeadura: '2026-02-01', disponivel: 5 },
  ];
  it('reserva primeiro os lotes mais antigos', () => {
    expect(planejarReservas([{ doacao_item_id: 'i1', especie_id: 'ipe', quantidade: 50 }], lotes)).toEqual({
      reservas: [
        { doacao_item_id: 'i1', lote_mudas_id: 'velho', quantidade: 30 },
        { doacao_item_id: 'i1', lote_mudas_id: 'novo', quantidade: 20 },
      ],
    });
  });
  it('não reserva nada se faltar muda', () => {
    expect(planejarReservas([{ doacao_item_id: 'i2', especie_id: 'baru', quantidade: 6 }], lotes)).toEqual({ erro: 'Faltam 1 mudas prontas para atender o item i2.' });
  });
  it('dois itens da mesma espécie não usam a mesma muda', () => {
    const r = planejarReservas(
      [
        { doacao_item_id: 'a', especie_id: 'ipe', quantidade: 100 },
        { doacao_item_id: 'b', especie_id: 'ipe', quantidade: 31 },
      ],
      lotes,
    );
    expect(r).toEqual({ erro: 'Faltam 1 mudas prontas para atender o item b.' });
  });
  it('situação depois da análise', () => {
    expect(situacaoAposAnalise([{ qtd_pedida: 10, qtd_aprovada: 10 }])).toBe('aprovada');
    expect(situacaoAposAnalise([{ qtd_pedida: 10, qtd_aprovada: 4 }])).toBe('aprovada_parcial');
    expect(situacaoAposAnalise([{ qtd_pedida: 10, qtd_aprovada: 0 }])).toBe('negada');
  });
  it('aprovação configurável por perfil', () => {
    expect(podeAprovar(['viveirista'], ['gestor'])).toBe(false);
    expect(podeAprovar(['viveirista'], ['gestor', 'viveirista'])).toBe(true);
  });
  it('reserva vencida não segura muda (volta ao catálogo)', () => {
    expect(reservaAtiva({ situacao: 'ativa', valida_ate: '2026-10-10' }, '2026-10-11')).toBe(false);
    expect(reservaAtiva({ situacao: 'ativa', valida_ate: '2026-10-11' }, '2026-10-11')).toBe(true);
    const d = disponivelPorLote(
      {
        lotesMudas: [{ id: 'l', fase_atual: 'pronta' }],
        movimentos: [{ id: 'm', lote_mudas_id: 'l', tipo: 'entrada', quantidade: 50 }],
        reservas: [
          { id: 'r1', lote_mudas_id: 'l', quantidade: 20, situacao: 'ativa', valida_ate: '2026-10-01' },
          { id: 'r2', lote_mudas_id: 'l', quantidade: 5, situacao: 'ativa', valida_ate: '2026-12-01' },
        ],
      },
      '2026-10-11',
    );
    expect(d.get('l')).toBe(45);
  });
});

describe('retirada', () => {
  const reservas = [
    { id: 'r1', doacao_item_id: 'i1', lote_mudas_id: 'velho', quantidade: 30, situacao: 'ativa' },
    { id: 'r2', doacao_item_id: 'i1', lote_mudas_id: 'novo', quantidade: 20, situacao: 'ativa' },
    { id: 'r3', doacao_item_id: 'i2', lote_mudas_id: 'baru', quantidade: 5, situacao: 'ativa' },
  ];
  it('consome as reservas e libera o que não foi levado', () => {
    expect(planejarRetirada(reservas, { i1: 40, i2: 0 })).toEqual({
      consumos: [
        { reserva_id: 'r1', doacao_item_id: 'i1', lote_mudas_id: 'velho', quantidade: 30 },
        { reserva_id: 'r2', doacao_item_id: 'i1', lote_mudas_id: 'novo', quantidade: 10 },
      ],
      liberar: ['r3'],
    });
  });
  it('não entrega mais que o reservado', () => {
    expect(planejarRetirada(reservas, { i1: 51 })).toEqual({ erro: expect.stringMatching(/reservadas 50/) });
  });
  it('prazo de retirada', () => {
    expect(prazoRetirada('2026-10-11T15:00:00Z', 30)).toBe('2026-11-10');
    expect(bloqueioRetirada({ situacao: 'aprovada', retirar_ate: '2026-11-10' }, '2026-11-10')).toBeNull();
    expect(bloqueioRetirada({ situacao: 'aprovada', retirar_ate: '2026-11-10' }, '2026-11-11')).toMatch(/venceu/);
    expect(bloqueioRetirada({ situacao: 'enviada' }, '2026-11-11')).toMatch(/aprovados/);
  });
});

describe('Plantando Água', () => {
  const hist = [
    { id: 'h1', doacao_id: 'd1', programa_id: 'pa', acao: 'marcou', criado_no_aparelho_em: '2026-10-01T10:00:00Z' },
    { id: 'h2', doacao_id: 'd1', programa_id: 'pa', acao: 'desmarcou', criado_no_aparelho_em: '2026-10-02T10:00:00Z' },
    { id: 'h3', doacao_id: 'd1', programa_id: 'pa', acao: 'marcou', criado_no_aparelho_em: '2026-10-03T10:00:00Z' },
    { id: 'h4', doacao_id: 'd2', programa_id: 'pa', acao: 'marcou', criado_no_aparelho_em: '2026-10-01T10:00:00Z' },
    { id: 'h5', doacao_id: 'd2', programa_id: 'pa', acao: 'desmarcou', criado_no_aparelho_em: '2026-10-05T10:00:00Z' },
  ];
  it('vale a última ação do histórico', () => {
    expect(marcadaNoPrograma(hist, 'd1', 'pa')).toBe(true);
    expect(marcadaNoPrograma(hist, 'd2', 'pa')).toBe(false);
    expect(marcadaNoPrograma(hist, 'd3', 'pa')).toBe(false);
  });
  it('desmarcar depois da retirada exige motivo', () => {
    expect(bloqueioDesmarcar({ situacao: 'retirada' }, ' ')).toMatch(/motivo/);
    expect(bloqueioDesmarcar({ situacao: 'retirada' }, 'pedido errado')).toBeNull();
    expect(bloqueioDesmarcar({ situacao: 'aprovada' }, '')).toBeNull();
  });
  it('o programa é um recorte: a doação conta uma vez só no total geral', () => {
    const doacoes = [
      { id: 'd1', situacao: 'retirada' },
      { id: 'd2', situacao: 'retirada' },
      { id: 'd3', situacao: 'cancelada' },
    ];
    const itens = [
      { id: 'a', doacao_id: 'd1', especie_id: 'ipe', qtd_pedida: 50, qtd_aprovada: 50, qtd_entregue: 50 },
      { id: 'b', doacao_id: 'd2', especie_id: 'ipe', qtd_pedida: 30, qtd_aprovada: 20, qtd_entregue: 20 },
      { id: 'c', doacao_id: 'd3', especie_id: 'ipe', qtd_pedida: 99, qtd_aprovada: 0, qtd_entregue: 0 },
    ];
    const geral = totaisDoacoes(doacoes, itens);
    const programa = totaisDoacoes(doacoes, itens, new Set(['d1']));
    expect(geral).toEqual({ pedidos: 2, mudas_pedidas: 80, mudas_aprovadas: 70, mudas_entregues: 70, por_especie: { ipe: 70 } });
    expect(programa).toMatchObject({ pedidos: 1, mudas_entregues: 50 });
    // marcar no programa não muda o total geral
    expect(totaisDoacoes(doacoes, itens)).toEqual(geral);
  });
});
