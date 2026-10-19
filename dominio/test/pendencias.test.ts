import { describe, expect, it } from 'vitest';
import { pendencias, type DadosPendencias } from '../src/pendencias';

const vazio: DadosPendencias = { doacoes: [], itens: [], baixas: [], plantios: [], matrizes: [], especies: [], pedidosAcesso: [], lotesSementes: [], movimentosSementes: [], lotesMudas: [], movimentosMudas: [], inventarios: [], monitoramentos: [], hoje: '2026-10-19' };
const tudo = () => true;

describe('pendências (número no botão do módulo)', () => {
  const doacoes = [
    { id: 'd1', situacao: 'enviada', viveiro_id: 'v', solicitante_usuario_id: 'ana' }, // para analisar
    { id: 'd2', situacao: 'aprovada', viveiro_id: 'v', solicitante_usuario_id: 'ana' }, // aguardando retirada
    { id: 'd3', situacao: 'retirada', viveiro_id: 'v', solicitante_usuario_id: 'ana' }, // retirado sem baixa
    { id: 'd4', situacao: 'retirada', viveiro_id: 'v', solicitante_usuario_id: 'ana' }, // retirado com baixa
    { id: 'd5', situacao: 'negada', viveiro_id: 'v', solicitante_usuario_id: 'ana' },
    { id: 'd6', situacao: 'enviada', viveiro_id: 'v', solicitante_usuario_id: 'ana', excluido: true },
  ];
  const itens = [
    { id: 'i3', doacao_id: 'd3', qtd_entregue: 0 },
    { id: 'i4', doacao_id: 'd4', qtd_entregue: 0 },
  ];
  const baixas = [{ id: 'b4', doacao_item_id: 'i4', quantidade: 10 }];

  it('equipe do viveiro: analisar, aguardando retirada e mudas que ainda não saíram', () => {
    expect(pendencias({ ...vazio, doacoes, itens, baixas }, { usuarioId: 'gestora', pode: tudo })).toEqual({ '/doacao': 3 });
  });

  it('quem pede: o pedido aprovado (buscar as mudas) e o plantio por registrar; nunca aprova o próprio', () => {
    const soPedir = (k: string) => k === 'pedir_mudas';
    expect(pendencias({ ...vazio, doacoes, itens, baixas, plantios: [{ id: 'p', doacao_id: 'd4' }] }, { usuarioId: 'ana', pode: soPedir })).toEqual({ '/doacao': 1, '/pos-plantio': 1 });
  });

  it('pós-plantio: plantio sem vistoria técnica conta para a equipe', () => {
    const plantios = [{ id: 'p1', doacao_id: 'x' }, { id: 'p2', doacao_id: 'y' }];
    const monitoramentos = [{ id: 'mo', plantio_id: 'p1', tipo: 'vistoria' }, { id: 'mr', plantio_id: 'p2', tipo: 'relato' }];
    expect(pendencias({ ...vazio, plantios, monitoramentos }, { usuarioId: 'g', pode: (k) => k === 'vistoria' })).toEqual({ '/pos-plantio': 1 });
  });

  it('sementes: lote sem peso, ou vencido ainda com sementes', () => {
    const lotesSementes = [
      { id: 's1', peso_g: 0 },
      { id: 's2', peso_g: 500, validade: '2026-01-01' },
      { id: 's3', peso_g: 500, validade: '2026-01-01' },
      { id: 's4', peso_g: 500, validade: '2027-01-01' },
    ];
    const movimentosSementes = [
      { id: 'a', lote_sementes_id: 's2', tipo: 'entrada', quantidade_g: 500 },
      { id: 'b', lote_sementes_id: 's3', tipo: 'entrada', quantidade_g: 500 },
      { id: 'c', lote_sementes_id: 's3', tipo: 'descarte', quantidade_g: 500 },
      { id: 'd', lote_sementes_id: 's4', tipo: 'entrada', quantidade_g: 500 },
    ];
    expect(pendencias({ ...vazio, lotesSementes, movimentosSementes }, { usuarioId: 'v', pode: tudo })).toEqual({ '/coleta': 2 });
  });

  it('viveiro: lote atrasado com mudas e inventário aberto', () => {
    const d = {
      ...vazio,
      especies: [{ id: 'e', meses_ate_pronta: 6 }],
      lotesMudas: [
        { id: 'l1', especie_id: 'e', data_semeadura: '2026-01-01', fase_atual: 'crescimento' }, // atrasado
        { id: 'l2', especie_id: 'e', data_semeadura: '2026-01-01', fase_atual: 'pronta' },
        { id: 'l3', especie_id: 'e', data_semeadura: '2026-09-01', fase_atual: 'crescimento' },
      ],
      movimentosMudas: ['l1', 'l2', 'l3'].map((l) => ({ id: `m${l}`, lote_mudas_id: l, tipo: 'entrada', quantidade: 10 })),
      inventarios: [{ id: 'i', situacao: 'aberto' }, { id: 'j', situacao: 'fechado' }],
    };
    expect(pendencias(d, { usuarioId: 'v', pode: tudo })).toEqual({ '/viveiro': 2 });
  });

  it('só conta onde a pessoa tem permissão', () => {
    const soRetirada = (k: string) => k === 'retirada';
    expect(pendencias({ ...vazio, doacoes, itens, baixas }, { usuarioId: 'v1', pode: soRetirada })).toEqual({ '/doacao': 2 });
    expect(pendencias({ ...vazio, doacoes }, { usuarioId: 'x', pode: () => false })).toEqual({});
  });

  it('matrizes sem espécie, espécies para revisar e pedidos de acesso', () => {
    const d = {
      ...vazio,
      matrizes: [
        { id: 'm1', especie_id: '', situacao: 'ativa' },
        { id: 'm2', especie_id: 'e', grau_certeza: 'provavel' },
        { id: 'm3', especie_id: 'e', grau_certeza: 'certo' },
        { id: 'm4', especie_id: '', situacao: 'morta' },
      ],
      especies: [{ id: 'e1', revisar: true }, { id: 'e2', revisar: false }],
      pedidosAcesso: [{ id: 'a1', situacao: 'pendente' }, { id: 'a2', situacao: 'aprovado' }],
    };
    expect(pendencias(d, { usuarioId: 'g', pode: tudo })).toEqual({ '/matrizes': 2, '/especies': 1, '/equipe': 1 });
  });
});
