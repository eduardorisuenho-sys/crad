import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivdoacao000001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: new Date().toISOString(),
  dispositivo_id: 'aparelho0000010',
  ...p,
});

describe.skipIf(!temPocketBase)('doação: análise com reservas no servidor', () => {
  let s: ServidorTeste;
  let gestor: { id: string; token: string };
  let viveirista: { id: string; token: string };
  let solicitante: { id: string; token: string };
  const especie = gerarId();
  const loteVelho = gerarId();
  const loteNovo = gerarId();
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000010', operacoes: ops });
  const catalogo = async () => (await chamar(s, '', 'GET', '/api/crads/publico/catalogo')).dados.itens[0]?.total ?? 0;

  async function novoPedido(qtd: number) {
    const doacao = gerarId();
    const item = gerarId();
    const pessoa = gerarId();
    const r = await enviar(solicitante.token, [
      op({ colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome: 'Solicitante Teste' } }),
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: `DO-P-TEST-${qtd}`, solicitante_pessoa_id: pessoa, situacao: 'enviada', viveiro_id: VIV, finalidade: 'teste' } }),
      op({ colecao: 'doacao_item', registro_id: item, tipo: 'criar', dados: { doacao_id: doacao, especie_id: especie, qtd_pedida: qtd, viveiro_id: VIV } }),
    ]);
    expect(r.dados.resultados.map((x: { status: string }) => x.status)).toEqual(['aplicada', 'aplicada', 'aplicada']);
    return { doacao, item };
  }

  beforeAll(async () => {
    s = await subirServidor();
    gestor = await criarUsuario(s, 'gestor@doacao.local', { gestor_geral: true });
    viveirista = await criarUsuario(s, 'viveirista@doacao.local');
    solicitante = await criarUsuario(s, 'solicitante@doacao.local', { solicitante: true });
    const r = await enviar(gestor.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'DOA', nome: 'Viveiro Doação', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: viveirista.id, perfil: 'viveirista', viveiro_id: VIV } }),
      op({ colecao: 'especie', registro_id: especie, tipo: 'criar', dados: { nome_cientifico: 'Doacia teste', publicada: true } }),
      // estes testes usam pedidos grandes: o limite por espécie (padrão 30) fica alto aqui
      op({ colecao: 'parametro', tipo: 'criar', dados: { chave: 'limite_mudas_por_especie', valor: 1000 } }),
      op({ colecao: 'lote_mudas', registro_id: loteNovo, tipo: 'criar', dados: { codigo: 'LM-2026-002-A', lote_sementes_id: 'x', especie_id: especie, data_semeadura: '2026-05-01', fase_atual: 'pronta', viveiro_id: VIV } }),
      op({ colecao: 'lote_mudas', registro_id: loteVelho, tipo: 'criar', dados: { codigo: 'LM-2026-001-A', lote_sementes_id: 'x', especie_id: especie, data_semeadura: '2026-01-01', fase_atual: 'pronta', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteVelho, tipo: 'entrada', quantidade: 30, data: '2026-03-01', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: loteNovo, tipo: 'entrada', quantidade: 100, data: '2026-07-01', viveiro_id: VIV } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
  }, 30_000);
  afterAll(() => s?.parar());

  it('o programa Plantando Água já vem cadastrado e chega aos aparelhos', async () => {
    const r = await chamar(s, viveirista.token, 'GET', '/api/crads/sync/receber?desde=0');
    expect(r.dados.registros.find((x: { colecao: string }) => x.colecao === 'programa').registro).toMatchObject({ id: 'plantandoagua01', nome: 'Plantando Água', versao: 1 });
  });

  it('só quem está nos perfis aprovadores analisa; aprovar reserva dos lotes mais antigos e tira do catálogo', async () => {
    const p = await novoPedido(50);
    expect(await catalogo()).toBe(130);
    const negado = await chamar(s, viveirista.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 50 }] });
    expect(negado).toMatchObject({ status: 400, dados: { message: expect.stringMatching(/permissão para aprovar/) } });
    const r = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 40 }], justificativa: 'parte do estoque vai para outro pedido' });
    expect(r.status).toBe(200);
    expect(r.dados.doacao).toMatchObject({ situacao: 'aprovada_parcial', analisado_por: gestor.id });
    expect(r.dados.doacao.retirar_ate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.dados.reservas).toEqual([
      { doacao_item_id: p.item, lote_mudas_id: loteVelho, quantidade: 30 },
      { doacao_item_id: p.item, lote_mudas_id: loteNovo, quantidade: 10 },
    ]);
    expect(await catalogo()).toBe(90);
    // analisar de novo não é possível
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [] })).status).toBe(400);
  });

  it('não reserva mais do que existe', async () => {
    const p = await novoPedido(95);
    const r = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 95 }] });
    expect(r).toMatchObject({ status: 400, dados: { message: expect.stringMatching(/Faltam 5 mudas/) } });
    expect(await catalogo()).toBe(90);
  });

  it('recusa exige motivo', async () => {
    const p = await novoPedido(1);
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 0 }] })).status).toBe(400);
    const r = await chamar(s, gestor.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 0 }], justificativa: 'fora da área atendida' });
    expect(r.dados.doacao.situacao).toBe('negada');
  });

  it('prazo vencido: a reserva expira e as mudas voltam ao catálogo', async () => {
    const r = await chamar(s, s.admin, 'POST', '/api/crads/manutencao/expirar', { hoje: '2099-01-01' });
    expect(r.dados).toEqual({ reservas: 2, pedidos: 1 });
    expect(await catalogo()).toBe(130);
  });
});
