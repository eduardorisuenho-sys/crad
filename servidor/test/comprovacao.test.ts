import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivcomprova0001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-11-19T10:00:00.000Z',
  dispositivo_id: 'aparelho0000077',
  ...p,
});

describe.skipIf(!temPocketBase)('comprovar o plantio antes de pedir mudas de novo', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let sol: { id: string; token: string };
  let retirada = '';
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000077', operacoes: ops });
  const criar = async (col: string, dados: object) => (await chamar(s, s.admin, 'POST', `/api/collections/${col}/records`, dados)).dados as { id: string };
  /** o solicitante faz um pedido novo pelo app (pedido + um item) */
  const pedir = async (t: string, usuarioId: string | null, pessoaId: string) => {
    const doacao = gerarId();
    const r = await enviar(t, [
      op({ colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: `DO-2026-${Math.floor(Math.random() * 900 + 100)}`, solicitante_pessoa_id: pessoaId, solicitante_usuario_id: usuarioId, situacao: 'enviada', viveiro_id: VIV, termo_aceito_em: '2026-11-19', termo_texto: 'Termo' } }),
      op({ colecao: 'doacao_item', tipo: 'criar', dados: { doacao_id: doacao, especie_id: 'especie0000001x', qtd_pedida: 5, viveiro_id: VIV } }),
    ]);
    return r.dados.resultados as { status: string; motivo?: string }[];
  };

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@comprova.local', { gestor_geral: true });
    sol = await criarUsuario(s, 'sol@comprova.local', { solicitante: true });
    await enviar(admin.token, [op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'CMP', nome: 'Viveiro Comprova', ativo: true } })]);
    const pessoa = await criar('pessoa', { nome: 'Quem Plantou', usuario_id: sol.id });
    await criar('dados_pessoais', { pessoa_id: pessoa.id, documento: '529.982.247-25' });
    retirada = (await criar('doacao', { codigo: 'DO-2026-501', solicitante_pessoa_id: pessoa.id, solicitante_usuario_id: sol.id, situacao: 'retirada', viveiro_id: VIV })).id;
  });
  afterAll(() => s?.parar());

  it('quem retirou e não comprovou o plantio não pede de novo; o item também não entra', async () => {
    const pessoa = await criar('pessoa', { nome: 'Quem Plantou', usuario_id: sol.id });
    const [doacao, item] = await pedir(sol.token, sol.id, pessoa.id);
    expect(doacao).toMatchObject({ status: 'rejeitada' });
    expect(doacao.motivo).toMatch(/^Antes de pedir mudas de novo, comprove o plantio do pedido DO-2026-501: em Pós-plantio/);
    expect(item).toMatchObject({ status: 'rejeitada', motivo: 'O pedido destas mudas não foi registrado.' });
    // o app pergunta antes de começar o pedido
    const c = (await chamar(s, sol.token, 'POST', '/api/crads/doacao/pendencias-plantio', {})).dados;
    expect(c.pendentes).toEqual([{ id: retirada, codigo: 'DO-2026-501' }]);
  });

  it('no balcão (ficha nova), a mesma pessoa é achada pelo CPF', async () => {
    const ficha = await criar('pessoa', { nome: 'Quem Plantou (balcão)' });
    await criar('dados_pessoais', { pessoa_id: ficha.id, documento: '52998224725' });
    const [doacao] = await pedir(admin.token, null, ficha.id);
    expect(doacao.status).toBe('rejeitada');
    // a equipe consulta pelo documento (só os códigos voltam)
    const c = (await chamar(s, admin.token, 'POST', '/api/crads/doacao/pendencias-plantio', { documento: '529.982.247-25' })).dados;
    expect(c.pendentes.map((p: { codigo: string }) => p.codigo)).toEqual(['DO-2026-501']);
    // o solicitante não consulta documento de outra pessoa
    expect((await chamar(s, sol.token, 'POST', '/api/crads/doacao/pendencias-plantio', { documento: '11144477735' })).status).toBe(403);
  });

  it('Plantando Água não precisa comprovar', async () => {
    await criar('doacao_programa_historico', { doacao_id: retirada, programa_id: 'plantandoagua01', acao: 'marcou', viveiro_id: VIV });
    const pessoa = await criar('pessoa', { nome: 'Quem Plantou', usuario_id: sol.id });
    const [doacao, item] = await pedir(sol.token, sol.id, pessoa.id);
    expect(doacao.status, doacao.motivo).toBe('aplicada');
    expect(item.status).toBe('aplicada');
  });

  it('plantio registrado com foto libera o próximo pedido', async () => {
    const outro = await criarUsuario(s, 'outro@comprova.local', { solicitante: true });
    const pessoa = await criar('pessoa', { nome: 'Outro', usuario_id: outro.id });
    const d = await criar('doacao', { codigo: 'DO-2026-502', solicitante_pessoa_id: pessoa.id, solicitante_usuario_id: outro.id, situacao: 'retirada', viveiro_id: VIV });
    expect((await pedir(outro.token, outro.id, pessoa.id))[0].status).toBe('rejeitada');
    const plantio = await criar('plantio', { doacao_id: d.id, data: '2026-11-19', solicitante_usuario_id: outro.id, viveiro_id: VIV });
    // registro de plantio sem foto ainda não comprova
    expect((await pedir(outro.token, outro.id, pessoa.id))[0].status).toBe('rejeitada');
    await criar('foto', { entidade: 'plantio', registro_id: plantio.id, parte: 'muda', viveiro_id: VIV });
    expect((await pedir(outro.token, outro.id, pessoa.id))[0].status).toBe('aplicada');
  });
});
