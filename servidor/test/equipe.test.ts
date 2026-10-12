import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, matrizPadrao, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivequipe000001';
const VIV2 = 'vivequipe000002';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: new Date().toISOString(),
  dispositivo_id: 'aparelho0000020',
  ...p,
});
const entrar = async (s: ServidorTeste, email: string, senha: string) =>
  (await chamar(s, '', 'POST', '/api/collections/users/auth-with-password', { identity: email, password: senha })).dados.token as string;

describe.skipIf(!temPocketBase)('contas, equipe e permissões', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let gestor: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000020', operacoes: ops });

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@equipe.local', { gestor_geral: true });
    gestor = await criarUsuario(s, 'gestor@equipe.local');
    const r = await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'EQ1', nome: 'Viveiro Um', ativo: true } }),
      op({ colecao: 'viveiro', registro_id: VIV2, tipo: 'criar', dados: { sigla: 'EQ2', nome: 'Viveiro Dois', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: gestor.id, perfil: 'gestor', viveiro_id: VIV } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
  });
  afterAll(() => s?.parar());

  it('lista os viveiros sem login', async () => {
    const r = await chamar(s, '', 'GET', '/api/crads/publico/viveiros');
    expect(r.dados.map((v: { nome: string }) => v.nome)).toEqual(['Viveiro Dois', 'Viveiro Um']);
  });

  it('solicitante cria a conta pelo celular e já entra', async () => {
    const r = await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'Maria Produtora', email: 'Maria@Roca.local', senha: 'senha-maria-1', perfil: 'solicitante' });
    expect(r.dados).toEqual({ ok: true, pendente: false });
    const t = await entrar(s, 'maria@roca.local', 'senha-maria-1');
    const eu = (await chamar(s, t, 'GET', '/api/crads/eu')).dados;
    expect(eu).toMatchObject({ solicitante: true, nome: 'Maria Produtora', perfisPorViveiro: {} });
    // e-mail repetido e senha curta são recusados
    expect((await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'Outra', email: 'maria@roca.local', senha: 'senha-maria-1' })).dados.message).toMatch(/já tem conta/);
    expect((await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'Outra', email: 'o@roca.local', senha: '123' })).dados.message).toMatch(/8 letras/);
  });

  it('coletor pede acesso; o gestor do viveiro aprova; quem não é gestor não vê a equipe', async () => {
    const r = await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'João Coletor', email: 'joao@campo.local', senha: 'senha-joao-1', perfil: 'coletor', viveiro_id: VIV });
    expect(r.dados.pendente).toBe(true);
    const tj = await entrar(s, 'joao@campo.local', 'senha-joao-1');
    let eu = (await chamar(s, tj, 'GET', '/api/crads/eu')).dados;
    expect(eu.perfisPorViveiro).toEqual({});
    expect(eu.pedidos_acesso).toEqual([{ perfil: 'coletor', viveiro: 'Viveiro Um', situacao: 'pendente', motivo: '' }]);
    expect((await chamar(s, tj, 'GET', '/api/crads/equipe')).status).toBe(403);

    const eq = (await chamar(s, gestor.token, 'GET', '/api/crads/equipe')).dados;
    expect(eq.viveiros.map((v: { nome: string }) => v.nome)).toEqual(['Viveiro Um']);
    expect(eq.pedidos).toHaveLength(1);
    const ok = await chamar(s, gestor.token, 'POST', `/api/crads/equipe/pedido/${eq.pedidos[0].id}`, { aprovar: true });
    expect(ok.status).toBe(200);
    eu = (await chamar(s, tj, 'GET', '/api/crads/eu')).dados;
    expect(eu.perfisPorViveiro).toEqual({ [VIV]: ['coletor'] });
    expect(eu.pedidos_acesso[0].situacao).toBe('aprovado');
    // já respondido
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/equipe/pedido/${eq.pedidos[0].id}`, { aprovar: true })).dados.message).toMatch(/já foi respondido/);
  });

  it('gestor cadastra viveirista; não pode cadastrar em viveiro alheio nem tirar o próprio acesso', async () => {
    const r = await chamar(s, gestor.token, 'POST', '/api/crads/equipe/pessoa', { nome: 'Ana Viveirista', email: 'ana@viveiro.local', senha: 'senha-ana-12', viveiro_id: VIV, perfil: 'viveirista' });
    expect(r.dados).toEqual({ ok: true, conta_nova: true });
    const ta = await entrar(s, 'ana@viveiro.local', 'senha-ana-12');
    expect((await chamar(s, ta, 'GET', '/api/crads/eu')).dados.perfisPorViveiro).toEqual({ [VIV]: ['viveirista'] });
    expect((await chamar(s, gestor.token, 'POST', '/api/crads/equipe/pessoa', { nome: 'X', email: 'x@x.local', senha: 'senha-xxx-12', viveiro_id: VIV2, perfil: 'coletor' })).dados.message).toMatch(/permissão/);
    const eq = (await chamar(s, gestor.token, 'GET', '/api/crads/equipe')).dados;
    const meu = eq.pessoas.find((p: { email: string }) => p.email === 'gestor@equipe.local').vinculos[0].id;
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/equipe/vinculo/${meu}/remover`)).dados.message).toMatch(/próprio acesso/);
    const ana = eq.pessoas.find((p: { email: string }) => p.email === 'ana@viveiro.local').vinculos[0].id;
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/equipe/vinculo/${ana}/remover`)).status).toBe(200);
    expect((await chamar(s, ta, 'GET', '/api/crads/eu')).dados.perfisPorViveiro).toEqual({});
  });

  it('a tabela de permissões vale no servidor e só o administrador muda', async () => {
    const tj = await entrar(s, 'joao@campo.local', 'senha-joao-1');
    const lote = () => op({ colecao: 'lote_mudas', tipo: 'criar', dados: { codigo: 'LM-P-EQ', lote_sementes_id: 'y', especie_id: 'x', fase_atual: 'semeadura', viveiro_id: VIV } });
    // coletor não semeia (padrão)
    const antes = (await enviar(tj, [lote()])).dados.resultados[0];
    expect(antes.status).toBe('rejeitada');
    expect(antes.motivo).toMatch(/permiss/);
    // gestor do viveiro não pode mudar a tabela
    const tabela = { ...matrizPadrao(), producao: ['coletor', 'viveirista', 'gestor'] };
    const pGestor = await enviar(gestor.token, [op({ colecao: 'parametro', tipo: 'criar', dados: { chave: 'permissoes', valor: tabela } })]);
    expect(pGestor.dados.resultados[0].status).toBe('rejeitada');
    const pAdmin = await enviar(admin.token, [op({ colecao: 'parametro', tipo: 'criar', dados: { chave: 'permissoes', valor: tabela } })]);
    expect(pAdmin.dados.resultados[0].status).toBe('aplicada');
    // agora o coletor pode semear
    const depois = (await enviar(tj, [lote()])).dados.resultados[0];
    expect(depois.status, JSON.stringify(depois)).toBe('aplicada');
  });
});
