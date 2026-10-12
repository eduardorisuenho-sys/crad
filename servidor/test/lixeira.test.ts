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
});
