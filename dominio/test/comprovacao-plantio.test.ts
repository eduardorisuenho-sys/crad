import { describe, expect, it } from 'vitest';
import { mensagemSemComprovacao, retiradasSemComprovacao } from '../src/doacao';

const doacoes = [
  { id: 'd1', codigo: 'DO-2026-010', situacao: 'retirada' },
  { id: 'd2', codigo: 'DO-2026-011', situacao: 'aprovada' },
  { id: 'd3', codigo: 'DO-2026-012', situacao: 'retirada' },
];

describe('comprovação do plantio antes de pedir de novo', () => {
  it('retirada sem plantio com foto fica pendente; pedido ainda não retirado não conta', () => {
    expect(retiradasSemComprovacao(doacoes, [], [], []).map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('plantio registrado com foto comprova; sem foto, não', () => {
    const plantios = [{ id: 'p1', doacao_id: 'd1' }, { id: 'p3', doacao_id: 'd3' }];
    const fotos = [{ id: 'f1', entidade: 'plantio', registro_id: 'p1' }];
    expect(retiradasSemComprovacao(doacoes, plantios, fotos, []).map((d) => d.id)).toEqual(['d3']);
    // foto excluída não vale
    expect(retiradasSemComprovacao(doacoes, plantios, [{ ...fotos[0], excluido: true }], []).map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('Plantando Água não precisa comprovar (vale a última marcação)', () => {
    const hist = [
      { id: 'h1', doacao_id: 'd3', programa_id: 'plantandoagua01', acao: 'marcou', criado_no_aparelho_em: '2026-11-01' },
      { id: 'h2', doacao_id: 'd1', programa_id: 'plantandoagua01', acao: 'marcou', criado_no_aparelho_em: '2026-11-01' },
      { id: 'h3', doacao_id: 'd1', programa_id: 'plantandoagua01', acao: 'desmarcou', criado_no_aparelho_em: '2026-11-02' },
    ];
    expect(retiradasSemComprovacao(doacoes, [], [], hist).map((d) => d.id)).toEqual(['d1']);
  });

  it('a mensagem diz quais pedidos faltam', () => {
    expect(mensagemSemComprovacao([doacoes[0], doacoes[2]])).toMatch(/^Antes de pedir mudas de novo, comprove o plantio dos pedidos DO-2026-010 e DO-2026-012: em Pós-plantio/);
  });
});
