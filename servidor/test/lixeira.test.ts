import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivlixeira00001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-12T10:00:00.000Z',
  dispositivo_id: 'aparelho0000040',
  ...p,
});

describe.skipIf(!temPocketBase)('lixeira e exclusão pelo administrador', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let gestor: { id: string; token: string };
  let coletor: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000040', operacoes: ops });
  const lerAdmin = async (col: string, id: string) => (await chamar(s, s.admin, 'GET', `/api/collections/${col}/records/${id}`)).status;

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@lixeira.local', { gestor_geral: true });
    gestor = await criarUsuario(s, 'gestor@lixeira.local');
    coletor = await criarUsuario(s, 'coletor@lixeira.local');
    await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'LIX', nome: 'Viveiro Lixeira', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: gestor.id, perfil: 'gestor', viveiro_id: VIV } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIV } }),
    ]);
  });
  afterAll(() => s?.parar());

  it('matriz reprovada vai para a lixeira; o administrador restaura ou apaga de vez (com fenologia e fotos)', async () => {
    const m = gerarId();
    const feno = gerarId();
    const foto = gerarId();
    const c = await enviar(coletor.token, [
      op({ colecao: 'matriz', registro_id: m, tipo: 'criar', dados: { codigo: 'MT-P-LIX-1', grau_certeza: 'provavel', situacao_validacao: 'pendente', viveiro_id: VIV } }),
      op({ colecao: 'fenologia', registro_id: feno, tipo: 'criar', dados: { matriz_id: m, data: '2026-10-12', fases: ['flor'], viveiro_id: VIV } }),
      op({ colecao: 'foto', registro_id: foto, tipo: 'criar', dados: { entidade: 'matriz', registro_id: m, parte: 'arvore', viveiro_id: VIV } }),
    ]);
    expect(c.dados.resultados.map((x: { status: string }) => x.status)).toEqual(['aplicada', 'aplicada', 'aplicada']);
    const versao = c.dados.resultados[0].registro.versao;
    const r = await enviar(gestor.token, [op({ colecao: 'matriz', registro_id: m, tipo: 'alterar', dados: { situacao_validacao: 'reprovada' }, base: { situacao_validacao: 'pendente' }, base_versao: versao })]);
    expect(r.dados.resultados[0].registro).toMatchObject({ situacao_validacao: 'reprovada', excluido: true });

    // gestor não vê a lixeira; administrador vê
    expect((await chamar(s, gestor.token, 'GET', '/api/crads/lixeira')).status).toBe(400);
    const lix = (await chamar(s, admin.token, 'GET', '/api/crads/lixeira')).dados.itens;
    expect(lix.find((i: { id: string }) => i.id === m)).toMatchObject({ colecao: 'matriz', tipo: 'Matrizes' });

    // restaurar e excluir de novo
    expect((await chamar(s, admin.token, 'POST', `/api/crads/lixeira/matriz/${m}/restaurar`)).status).toBe(200);
    expect((await chamar(s, s.admin, 'GET', `/api/collections/matriz/records/${m}`)).dados.excluido).toBe(false);
    const atual = (await chamar(s, s.admin, 'GET', `/api/collections/matriz/records/${m}`)).dados;
    await enviar(admin.token, [op({ colecao: 'matriz', registro_id: m, tipo: 'excluir', base_versao: atual.versao })]);

    // apagar de vez leva junto a fenologia e a foto
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/lixeira/matriz/${m}/apagar`)).status).toBe(400);
    const ap = await chamar(s, admin.token, 'POST', `/api/crads/lixeira/matriz/${m}/apagar`);
    expect(ap.dados).toMatchObject({ ok: true, rotulo: expect.stringMatching(/^MT-/) });
    expect([await lerAdmin('matriz', m), await lerAdmin('fenologia', feno), await lerAdmin('foto', foto)]).toEqual([404, 404, 404]);

    // os aparelhos recebem uma lápide e tiram o registro e os detalhes (mesmo quem só viu antes da exclusão)
    const lido = async (desde: number) => (await chamar(s, gestor.token, 'GET', `/api/crads/sync/receber?desde=${desde}&limite=2000`)).dados;
    const rec = await lido(0);
    const lapides = rec.registros.filter((x: { registro: { id: string } }) => [m, feno, foto].includes(x.registro.id));
    expect(lapides.map((x: { colecao: string; registro: { excluido: boolean } }) => [x.colecao, x.registro.excluido]).sort()).toEqual([['fenologia', true], ['foto', true], ['matriz', true]]);
  });

  it('não apaga de vez o que ainda tem registros ativos ligados (ex.: matriz com coleta)', async () => {
    const m = gerarId();
    await enviar(coletor.token, [
      op({ colecao: 'matriz', registro_id: m, tipo: 'criar', dados: { codigo: 'MT-P-LIX-2', grau_certeza: 'certo', viveiro_id: VIV } }),
      op({ colecao: 'coleta', tipo: 'criar', dados: { matriz_id: m, data: '2026-10-12', viveiro_id: VIV } }),
    ]);
    const v = (await chamar(s, s.admin, 'GET', `/api/collections/matriz/records/${m}`)).dados.versao;
    await enviar(admin.token, [op({ colecao: 'matriz', registro_id: m, tipo: 'excluir', base_versao: v })]);
    const ap = await chamar(s, admin.token, 'POST', `/api/crads/lixeira/matriz/${m}/apagar`);
    expect(ap.dados.message).toMatch(/1 em coleta/);
    // só apaga de vez o que já está na lixeira
    const outra = gerarId();
    await enviar(coletor.token, [op({ colecao: 'matriz', registro_id: outra, tipo: 'criar', dados: { codigo: 'MT-P-LIX-3', grau_certeza: 'certo', viveiro_id: VIV } })]);
    expect((await chamar(s, admin.token, 'POST', `/api/crads/lixeira/matriz/${outra}/apagar`)).dados.message).toMatch(/Exclua primeiro/);
  });

  it('pedido retirado, lote e espécie de teste: apaga tudo de vez, na ordem (retiradas, inventário e reservas vão junto)', async () => {
    const criar = async (col: string, dados: object) => {
      const r = await chamar(s, s.admin, 'POST', `/api/collections/${col}/records`, { versao: 1, excluido: false, viveiro_id: VIV, ...dados });
      expect(r.status).toBe(200);
      return r.dados.id as string;
    };
    const esp = await criar('especie', { nome_cientifico: 'Lixeiria demonstrativa' });
    const lote = await criar('lote_mudas', { codigo: 'LM-2026-I-905', especie_id: esp, fase_atual: 'pronta', origem: 'estoque_inicial' });
    await criar('movimento_estoque_mudas', { lote_mudas_id: lote, tipo: 'entrada', quantidade: 3 });
    const inv = await criar('inventario', { data: '2026-10-12' });
    await criar('inventario_item', { inventario_id: inv, lote_mudas_id: lote, contado: 3, saldo_sistema: 3 });
    const pessoa = await criar('pessoa', { nome: 'Pedido de teste' });
    const doacao = await criar('doacao', { codigo: 'DO-2026-905', solicitante_pessoa_id: pessoa, situacao: 'retirada' });
    const item = await criar('doacao_item', { doacao_id: doacao, especie_id: esp, qtd_pedida: 1, qtd_aprovada: 1 });
    await criar('reserva', { doacao_item_id: item, lote_mudas_id: lote, quantidade: 1, situacao: 'consumida' });
    await criar('doacao_item_lote', { doacao_item_id: item, lote_mudas_id: lote, quantidade: 1 });
    for (let i = 0; i < 3; i++) await criar('retirada', { doacao_id: doacao, data: '2026-10-16', recebedor_nome: 'Teste' });
    // vão para a lixeira
    for (const [col, id] of [['especie', esp], ['lote_mudas', lote], ['doacao', doacao]]) {
      expect((await chamar(s, s.admin, 'PATCH', `/api/collections/${col}/records/${id}`, { excluido: true })).status).toBe(200);
    }
    // a espécie ainda está no item do pedido: a mensagem diz
    expect((await chamar(s, admin.token, 'POST', `/api/crads/lixeira/especie/${esp}/apagar`)).dados.message).toMatch(/1 em item de pedido/);
    // na ordem certa, tudo sai
    for (const [col, id] of [['doacao', doacao], ['lote_mudas', lote], ['especie', esp]]) {
      const r = await chamar(s, admin.token, 'POST', `/api/crads/lixeira/${col}/${id}/apagar`);
      expect(r.status, `${col}: ${JSON.stringify(r.dados)}`).toBe(200);
    }
    for (const col of ['retirada', 'reserva', 'doacao_item_lote', 'doacao_item', 'inventario_item', 'movimento_estoque_mudas']) {
      const r = await chamar(s, s.admin, 'GET', `/api/collections/${col}/records?filter=${encodeURIComponent(col === 'retirada' ? `doacao_id='${doacao}'` : col === 'doacao_item' ? `doacao_id='${doacao}'` : `lote_mudas_id='${lote}'`)}`);
      expect(r.dados.items, col).toEqual([]);
    }
  });

  it('reserva ativa segura o lote (pedido aprovado em aberto)', async () => {
    const lote = (await chamar(s, s.admin, 'POST', '/api/collections/lote_mudas/records', { codigo: 'LM-2026-I-906', especie_id: 'x', fase_atual: 'pronta', viveiro_id: VIV, versao: 1, excluido: true })).dados.id;
    await chamar(s, s.admin, 'POST', '/api/collections/reserva/records', { doacao_item_id: 'y', lote_mudas_id: lote, quantidade: 2, situacao: 'ativa', viveiro_id: VIV, versao: 1 });
    expect((await chamar(s, admin.token, 'POST', `/api/crads/lixeira/lote_mudas/${lote}/apagar`)).dados.message).toMatch(/1 em reserva/);
  });

  it('pessoa apagada de vez some com os dados pessoais e não fica no histórico', async () => {
    const p = gerarId();
    await enviar(admin.token, [
      op({ colecao: 'pessoa', registro_id: p, tipo: 'criar', dados: { nome: 'Nome Errado Teste' } }),
      op({ colecao: 'dados_pessoais', tipo: 'criar', dados: { pessoa_id: p, telefone: '63 90000-0000' } }),
    ]);
    const v = (await chamar(s, s.admin, 'GET', `/api/collections/pessoa/records/${p}`)).dados.versao;
    await enviar(admin.token, [op({ colecao: 'pessoa', registro_id: p, tipo: 'excluir', base_versao: v })]);
    expect((await chamar(s, admin.token, 'POST', `/api/crads/lixeira/pessoa/${p}/apagar`)).status).toBe(200);
    const aud = (await chamar(s, s.admin, 'GET', `/api/collections/auditoria/records?perPage=500`)).dados.items;
    expect(JSON.stringify(aud)).not.toContain('Nome Errado Teste');
    expect(JSON.stringify(aud)).not.toContain('90000-0000');
  });

  it('administrador apaga a conta de alguém da equipe (não a própria)', async () => {
    const x = await criarUsuario(s, 'errado@lixeira.local');
    await enviar(admin.token, [op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: x.id, perfil: 'viveirista', viveiro_id: VIV } })]);
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/equipe/usuario/${x.id}/apagar`)).status).toBe(400);
    expect((await chamar(s, admin.token, 'POST', `/api/crads/equipe/usuario/${admin.id}/apagar`)).dados.message).toMatch(/própria/);
    expect((await chamar(s, admin.token, 'POST', `/api/crads/equipe/usuario/${x.id}/apagar`)).status).toBe(200);
    expect(await lerAdmin('users', x.id)).toBe(404);
    const eq = (await chamar(s, admin.token, 'GET', '/api/crads/equipe')).dados;
    expect(eq.pessoas.some((p: { usuario_id: string }) => p.usuario_id === x.id)).toBe(false);
  });

  it('freio contra robôs: cada endereço cria no máximo 10 contas por hora', async () => {
    const st: number[] = [];
    for (let i = 0; i < 11; i++) st.push((await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'x' })).status);
    expect(st.slice(0, 10).every((x) => x !== 429)).toBe(true);
    expect(st[10]).toBe(429);
  });
});
