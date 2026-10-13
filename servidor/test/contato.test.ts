import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivcontato00001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-13T10:00:00.000Z',
  dispositivo_id: 'aparelho0000050',
  ...p,
});

describe.skipIf(!temPocketBase)('contato para combinar a retirada', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let viveirista: { id: string; token: string };
  let coletor: { id: string; token: string };
  let solicitante: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000050', operacoes: ops });
  const contato = (t: string, id: string) => chamar(s, t, 'GET', `/api/crads/doacao/${id}/contato`);

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@contato.local', { gestor_geral: true });
    viveirista = await criarUsuario(s, 'viv@contato.local');
    coletor = await criarUsuario(s, 'col@contato.local');
    solicitante = await criarUsuario(s, 'sol@contato.local', { solicitante: true });
    await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'CON', nome: 'Viveiro Contato', ativo: true, telefone: '(63) 3000-0000' } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: viveirista.id, perfil: 'viveirista', viveiro_id: VIV } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIV } }),
    ]);
  });
  afterAll(() => s?.parar());

  it('só depois da aprovação, só para quem entrega mudas, e o acesso fica na auditoria', async () => {
    const pessoa = gerarId();
    const doacao = gerarId();
    await enviar(solicitante.token, [
      op({ colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome: 'Pessoa Contato', usuario_id: solicitante.id } }),
      op({ colecao: 'dados_pessoais', tipo: 'criar', dados: { pessoa_id: pessoa, telefone: '63 98888-7777' } }),
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: 'DO-2026-950', solicitante_pessoa_id: pessoa, solicitante_usuario_id: solicitante.id, situacao: 'enviada', viveiro_id: VIV } }),
    ]);
    expect((await contato(viveirista.token, doacao)).dados.message).toMatch(/depois que o pedido é aprovado/);
    // aprovado (como faria a análise)
    const atual = (await chamar(s, s.admin, 'GET', `/api/collections/doacao/records/${doacao}`)).dados;
    await chamar(s, s.admin, 'PATCH', `/api/collections/doacao/records/${doacao}`, { situacao: 'aprovada', versao: atual.versao });
    expect((await contato(coletor.token, doacao)).dados.message).toMatch(/permissão/);
    expect((await contato(solicitante.token, doacao)).status).toBe(400);
    const r = await contato(viveirista.token, doacao);
    expect(r.dados).toEqual({ nome: 'Pessoa Contato', telefone: '63 98888-7777' });
    const aud = (await chamar(s, s.admin, 'GET', `/api/collections/auditoria/records?perPage=200&filter=${encodeURIComponent(`acao='ver_contato'`)}`)).dados.items;
    expect(aud).toEqual([expect.objectContaining({ registro_id: doacao, usuario_id: viveirista.id })]);
  });

  it('limite de 30 mudas por espécie também vale na análise', async () => {
    const doacao = gerarId();
    const item = gerarId();
    await enviar(admin.token, [
      op({ colecao: 'especie', registro_id: 'espcontato00001', tipo: 'criar', dados: { nome_cientifico: 'Contatia teste', publicada: true } }),
      op({ colecao: 'pessoa', registro_id: 'pescontato00001', tipo: 'criar', dados: { nome: 'Balcão' } }),
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: 'DO-2026-951', solicitante_pessoa_id: 'pescontato00001', situacao: 'enviada', viveiro_id: VIV } }),
      op({ colecao: 'doacao_item', registro_id: item, tipo: 'criar', dados: { doacao_id: doacao, especie_id: 'espcontato00001', qtd_pedida: 50, viveiro_id: VIV } }),
    ]);
    const r = await chamar(s, admin.token, 'POST', `/api/crads/doacao/${doacao}/analisar`, { itens: [{ item_id: item, qtd_aprovada: 31 }] });
    expect(r.dados.message).toMatch(/até 30 mudas/);
  });
});
