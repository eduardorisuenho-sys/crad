import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

// Coluna "perfil" na tabela de usuários do painel: diz quem é coletor, viveirista, gestor, solicitante ou administrador.
const VIV = 'vivperfil000001';
const VIV2 = 'vivperfil000002';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: new Date().toISOString(),
  dispositivo_id: 'aparelho0000031',
  ...p,
});

describe.skipIf(!temPocketBase)('perfil na tabela de usuários', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let gestor: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000031', operacoes: ops });
  const perfil = async (id: string) => (await chamar(s, s.admin, 'GET', `/api/collections/users/records/${id}`)).dados.perfil as string;
  const idPorEmail = async (email: string) =>
    (await chamar(s, s.admin, 'GET', `/api/collections/users/records?filter=${encodeURIComponent(`email = '${email}'`)}`)).dados.items[0].id as string;

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@perfil.local', { gestor_geral: true });
    gestor = await criarUsuario(s, 'gestor@perfil.local');
    const r = await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'PF1', nome: 'CRAD Palmas', ativo: true } }),
      op({ colecao: 'viveiro', registro_id: VIV2, tipo: 'criar', dados: { sigla: 'PF2', nome: 'CRAD Araguaína', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: gestor.id, perfil: 'gestor', viveiro_id: VIV } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: gestor.id, perfil: 'coletor', viveiro_id: VIV2 } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
  });
  afterAll(() => s?.parar());

  it('vem logo depois do nome', async () => {
    const col = (await chamar(s, s.admin, 'GET', '/api/collections/users')).dados;
    const nomes = col.fields.map((f: { name: string }) => f.name);
    expect(nomes.indexOf('perfil')).toBe(nomes.indexOf('name') + 1);
  });

  it('mostra administrador, gestor e coletor com o viveiro de cada perfil', async () => {
    expect(await perfil(admin.id)).toBe('Administrador');
    expect(await perfil(gestor.id)).toBe('Coletor (CRAD Araguaína) · Gestor (CRAD Palmas)');
  });

  it('solicitante e pedido de acesso aguardando aprovação; muda quando o gestor aprova', async () => {
    await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'Maria Produtora', email: 'maria@perfil.local', senha: 'senha-maria-1', perfil: 'solicitante' });
    expect(await perfil(await idPorEmail('maria@perfil.local'))).toBe('Solicitante');

    await chamar(s, '', 'POST', '/api/crads/conta', { nome: 'Bruno Viveiro', email: 'bruno@perfil.local', senha: 'senha-bruno-1', perfil: 'viveirista', viveiro_id: VIV });
    const bruno = await idPorEmail('bruno@perfil.local');
    expect(await perfil(bruno)).toBe('Viveirista (CRAD Palmas, aguardando aprovação)');

    const eq = (await chamar(s, gestor.token, 'GET', '/api/crads/equipe')).dados;
    expect(eq.pedidos).toHaveLength(1);
    expect((await chamar(s, gestor.token, 'POST', `/api/crads/equipe/pedido/${eq.pedidos[0].id}`, { aprovar: true })).status).toBe(200);
    expect(await perfil(bruno)).toBe('Viveirista (CRAD Palmas)');
  });

  it('quem perde o acesso fica "Sem perfil"; editar a coluna no painel não vale', async () => {
    const u = await criarUsuario(s, 'ex@perfil.local');
    expect(await perfil(u.id)).toBe('Sem perfil');
    await chamar(s, s.admin, 'PATCH', `/api/collections/users/records/${u.id}`, { perfil: 'Gestor' });
    expect(await perfil(u.id)).toBe('Sem perfil');
  });
});
