/**
 * Situações de verdade, combinadas: duas pessoas disputando as últimas mudas,
 * quem pediu tentando se aprovar, dados de outra pessoa, espécie fictícia,
 * lote na lixeira, perda depois da reserva e espécie importada sem publicar.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivcenarios0001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: new Date().toISOString(),
  dispositivo_id: 'aparelho0000077',
  ...p,
});
type Usuario = { id: string; token: string };

describe.skipIf(!temPocketBase)('cenários: do estoque à retirada, com gente diferente', () => {
  let s: ServidorTeste;
  let gestor: Usuario;
  let viveirista: Usuario;
  let ana: Usuario;
  let bruno: Usuario;
  const ipe = gerarId(); // espécie importada da lista oficial, não publicada
  const treino = gerarId(); // fictícia
  const loteIpe = gerarId();
  const loteTreino = gerarId();
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000077', operacoes: ops });
  const status = (r: { dados: { resultados: { status: string }[] } }) => r.dados.resultados.map((x) => x.status);
  const catalogo = async () => (await chamar(s, '', 'GET', '/api/crads/publico/catalogo')).dados as { itens: { especie_id: string; total: number; ficticia?: boolean }[]; regras: number };
  const noCatalogo = async (id: string) => (await catalogo()).itens.find((i) => i.especie_id === id)?.total ?? 0;

  async function pedir(u: Usuario, nome: string, qtd: number) {
    const [doacao, item, pessoa] = [gerarId(), gerarId(), gerarId()];
    const r = await enviar(u.token, [
      op({ colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome, cpf: '000.000.000-00', telefone: '63 90000-0000' } }),
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: `DO-P-${nome.toUpperCase()}-1`, solicitante_pessoa_id: pessoa, situacao: 'enviada', viveiro_id: VIV, finalidade: 'teste', termo_aceito_em: '2026-10-16', termo_texto: 'Termo de compromisso aceito' } }),
      op({ colecao: 'doacao_item', registro_id: item, tipo: 'criar', dados: { doacao_id: doacao, especie_id: ipe, qtd_pedida: qtd, viveiro_id: VIV } }),
    ]);
    expect(status(r)).toEqual(['aplicada', 'aplicada', 'aplicada']);
    return { doacao, item };
  }

  beforeAll(async () => {
    s = await subirServidor();
    gestor = await criarUsuario(s, 'gestor@cenarios.local', { gestor_geral: true });
    viveirista = await criarUsuario(s, 'viveirista@cenarios.local');
    ana = await criarUsuario(s, 'ana@cenarios.local', { solicitante: true });
    bruno = await criarUsuario(s, 'bruno@cenarios.local', { solicitante: true });
    const r = await enviar(gestor.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'CEN', nome: 'Viveiro Cenários', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: viveirista.id, perfil: 'viveirista', viveiro_id: VIV } }),
      op({ colecao: 'especie', registro_id: ipe, tipo: 'criar', dados: { nome_cientifico: 'Importia cenarialis', fonte_cadastro: 'flora_funga', publicada: false } }),
      op({ colecao: 'especie', registro_id: treino, tipo: 'criar', dados: { nome_cientifico: 'Ficticia treino', ficticia: true, publicada: true } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
    // o viveirista registra as mudas que já estavam no viveiro: 40 da importada e 50 da fictícia
    const v = await enviar(viveirista.token, [
      op({ colecao: 'lote_mudas', registro_id: loteIpe, tipo: 'criar', dados: { codigo: 'LM-P-CEN-1', especie_id: ipe, fase_atual: 'pronta', origem: 'estoque_inicial', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteIpe, tipo: 'entrada', quantidade: 40, data: '2026-03-01', viveiro_id: VIV } }),
      op({ colecao: 'lote_mudas', registro_id: loteTreino, tipo: 'criar', dados: { codigo: 'LM-P-CEN-2', especie_id: treino, fase_atual: 'pronta', origem: 'estoque_inicial', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteTreino, tipo: 'entrada', quantidade: 50, data: '2026-03-01', viveiro_id: VIV } }),
    ]);
    expect(status(v)).toEqual(['aplicada', 'aplicada', 'aplicada', 'aplicada']);
  }, 30_000);
  afterAll(() => s?.parar());

  it('espécie importada e não publicada aparece no catálogo, e as de exemplo também (sem exceção)', async () => {
    const c = await catalogo();
    expect(c.regras).toBe(3);
    expect(await noCatalogo(ipe)).toBe(40);
    expect(await noCatalogo(treino)).toBe(50);
    expect((await chamar(s, '', 'GET', `/api/crads/publico/especie/${ipe}`)).status).toBe(200);
    expect((await chamar(s, '', 'GET', `/api/crads/publico/especie/${treino}`)).status).toBe(200);
  });

  let pedidoAna: { doacao: string; item: string };
  let pedidoBruno: { doacao: string; item: string };

  it('quem pediu não consegue aprovar o próprio pedido, nem reservar, nem mexer no estoque', async () => {
    pedidoAna = await pedir(ana, 'Ana', 30);
    expect((await chamar(s, ana.token, 'POST', `/api/crads/doacao/${pedidoAna.doacao}/analisar`, { itens: [{ item_id: pedidoAna.item, qtd_aprovada: 30 }] })).status).toBe(400);
    const r = await enviar(ana.token, [
      op({ colecao: 'doacao', registro_id: pedidoAna.doacao, tipo: 'alterar', dados: { situacao: 'aprovada' }, base: { situacao: 'enviada' }, base_versao: 1 }),
      op({ colecao: 'reserva', tipo: 'criar', dados: { doacao_item_id: pedidoAna.item, lote_mudas_id: loteIpe, quantidade: 30, situacao: 'ativa', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteIpe, tipo: 'entrada', quantidade: 999, data: '2026-03-01', viveiro_id: VIV } }),
    ]);
    expect(status(r).every((x) => x !== 'aplicada')).toBe(true);
    expect(await noCatalogo(ipe)).toBe(40);
  });

  it('duas pessoas disputam as últimas mudas: quem é aprovado primeiro leva; o outro só recebe o que sobrou', async () => {
    pedidoBruno = await pedir(bruno, 'Bruno', 30);
    const a = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${pedidoAna.doacao}/analisar`, { itens: [{ item_id: pedidoAna.item, qtd_aprovada: 30 }] });
    expect(a.dados.doacao.situacao).toBe('aprovada');
    expect(await noCatalogo(ipe)).toBe(10);
    const demais = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${pedidoBruno.doacao}/analisar`, { itens: [{ item_id: pedidoBruno.item, qtd_aprovada: 30 }] });
    expect(demais).toMatchObject({ status: 400, dados: { message: expect.stringMatching(/Faltam 20 mudas/) } });
    const b = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${pedidoBruno.doacao}/analisar`, { itens: [{ item_id: pedidoBruno.item, qtd_aprovada: 10 }] });
    expect(b.dados.doacao.situacao).toBe('aprovada_parcial');
    expect(await noCatalogo(ipe)).toBe(0);
  });

  it('sem aceitar o termo de compromisso, o pedido não entra', async () => {
    const r = await enviar(ana.token, [
      op({ colecao: 'doacao', tipo: 'criar', dados: { codigo: 'DO-P-SEMTERMO-1', solicitante_pessoa_id: 'x', situacao: 'enviada', viveiro_id: VIV, finalidade: 'teste' } }),
    ]);
    expect(r.dados.resultados[0]).toMatchObject({ status: 'rejeitada', motivo: expect.stringMatching(/termo de compromisso/) });
  });

  it('cada um só recebe os próprios pedidos e dados (LGPD)', async () => {
    const r = await chamar(s, bruno.token, 'GET', '/api/crads/sync/receber?desde=0');
    const regs = r.dados.registros as { colecao: string; registro: Record<string, unknown> }[];
    const doacoes = regs.filter((x) => x.colecao === 'doacao').map((x) => x.registro.id);
    expect(doacoes).toContain(pedidoBruno.doacao);
    expect(doacoes).not.toContain(pedidoAna.doacao);
    expect(JSON.stringify(regs.filter((x) => x.colecao === 'pessoa'))).not.toContain('Ana');
    // o viveirista vê o pedido, mas não o CPF de ninguém
    const v = await chamar(s, viveirista.token, 'GET', '/api/crads/sync/receber?desde=0');
    expect(JSON.stringify(v.dados.registros)).not.toContain('000.000.000-00');
  });

  it('perda depois da reserva: o catálogo não fica negativo e a retirada não entrega o que morreu', async () => {
    const r = await enviar(viveirista.token, [op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteIpe, tipo: 'perda', quantidade: 15, data: '2026-04-01', viveiro_id: VIV } })]);
    expect(status(r)).toEqual(['aplicada']);
    // 40 − 15 = 25 vivas, 40 reservadas: nada sobra para o catálogo (nunca negativo)
    expect(await noCatalogo(ipe)).toBe(0);
    expect((await catalogo()).itens.every((i) => i.total > 0)).toBe(true);
  });

  it('lote na lixeira sai do catálogo; restaurado, volta', async () => {
    const outro = gerarId();
    const r = await enviar(viveirista.token, [
      op({ colecao: 'lote_mudas', registro_id: outro, tipo: 'criar', dados: { codigo: 'LM-P-CEN-3', especie_id: ipe, fase_atual: 'pronta', origem: 'estoque_inicial', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: outro, tipo: 'entrada', quantidade: 12, data: '2026-05-01', viveiro_id: VIV } }),
    ]);
    expect(status(r)).toEqual(['aplicada', 'aplicada']);
    expect(await noCatalogo(ipe)).toBe(12);
    const ex = await enviar(gestor.token, [op({ colecao: 'lote_mudas', registro_id: outro, tipo: 'excluir', base_versao: 1 })]);
    expect(status(ex)).toEqual(['aplicada']);
    expect(await noCatalogo(ipe)).toBe(0);
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/lixeira/lote_mudas/${outro}/restaurar`)).status).toBe(200);
    expect(await noCatalogo(ipe)).toBe(12);
  });
});
