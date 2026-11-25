import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

// PNG de 1×1 (transparente)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-11-25T10:00:00.000Z',
  dispositivo_id: 'aparelho0000099',
  ...p,
});

describe.skipIf(!temPocketBase)('logomarca da instituição', () => {
  let s: ServidorTeste;
  let gestor: { id: string; token: string };
  let coletor: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000099', operacoes: ops });
  const publica = async () => (await chamar(s, '', 'GET', '/api/crads/publico/logomarca')).dados.logomarca;

  beforeAll(async () => {
    s = await subirServidor();
    gestor = await criarUsuario(s, 'gestor@logo.local', { gestor_geral: true });
    coletor = await criarUsuario(s, 'coletor@logo.local');
  }, 30_000);
  afterAll(() => s?.parar());

  it('sem logomarca: a rota pública devolve vazio', async () => {
    expect(await publica()).toBeNull();
  });

  it('o gestor coloca a logomarca em Ajustes; qualquer pessoa vê, até sem login', async () => {
    const id = gerarId();
    const logo = { imagem: PNG, largura: 1, altura: 1, nome: 'Instituição Teste' };
    const r = await enviar(gestor.token, [op({ colecao: 'parametro', registro_id: id, tipo: 'criar', dados: { chave: 'logomarca_instituicao', valor: logo, descricao: 'Logomarca da instituição' } })]);
    expect(r.dados.resultados[0].status).toBe('aplicada');
    expect(await publica()).toEqual(logo);
    // quem não é gestor não troca a logomarca
    const outra = await enviar(coletor.token, [op({ colecao: 'parametro', tipo: 'criar', dados: { chave: 'logomarca_instituicao', valor: { imagem: PNG, largura: 2, altura: 2 } } })]);
    expect(outra.dados.resultados[0].status).toBe('rejeitada');
    expect((await publica()).largura).toBe(1);
  });

  it('só aceita imagem', async () => {
    await chamar(s, s.admin, 'PATCH', `/api/collections/parametro/records/${(await chamar(s, s.admin, 'GET', `/api/collections/parametro/records?filter=${encodeURIComponent("chave='logomarca_instituicao'")}`)).dados.items[0].id}`, { valor: { imagem: 'javascript:alert(1)' } });
    expect(await publica()).toBeNull();
  });
});
