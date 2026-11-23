import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivliberar00001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-11-23T10:00:00.000Z',
  dispositivo_id: 'aparelho0000088',
  ...p,
});

describe.skipIf(!temPocketBase)('mudas registradas antes de ficarem prontas', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  const ler = async (col: string, id: string) => (await chamar(s, s.admin, 'GET', `/api/collections/${col}/records/${id}`)).dados;
  const noCatalogo = async () => {
    const { itens } = (await chamar(s, '', 'GET', '/api/crads/publico/catalogo')).dados;
    return itens.find((i: { nomes_populares: string[] }) => i.nomes_populares.includes('Árvore-que-espera'))?.total ?? 0;
  };

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@liberar.local', { gestor_geral: true });
    const r = await chamar(s, admin.token, 'POST', '/api/crads/sync/enviar', {
      dispositivo_id: 'aparelho0000088',
      operacoes: [
        op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'LIB', nome: 'Viveiro Liberar', ativo: true } }),
        op({ colecao: 'especie', registro_id: 'especieliberar1', tipo: 'criar', dados: { nome_cientifico: 'Esperia teste', publicada: true } }),
        op({ colecao: 'nome_popular', tipo: 'criar', dados: { especie_id: 'especieliberar1', nome: 'Árvore-que-espera', nome_busca: 'arvore que espera' } }),
        op({ colecao: 'lote_mudas', registro_id: 'loteliberar0001', tipo: 'criar', dados: { codigo: 'LM-2026-I-070', origem: 'estoque_inicial', especie_id: 'especieliberar1', fase_atual: 'crescimento', situacao: 'ativo', pronta_em: '2027-02-23', viveiro_id: VIV } }),
        op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: 'loteliberar0001', tipo: 'entrada', quantidade: 40, data: '2026-11-23', viveiro_id: VIV } }),
        op({ colecao: 'lote_mudas', registro_id: 'loteliberar0002', tipo: 'criar', dados: { codigo: 'LM-2026-I-071', origem: 'estoque_inicial', especie_id: 'especieliberar1', fase_atual: 'crescimento', situacao: 'ativo', pronta_em: '2027-05-23', viveiro_id: VIV } }),
        op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: 'loteliberar0002', tipo: 'entrada', quantidade: 15, data: '2026-11-23', viveiro_id: VIV } }),
      ],
    });
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
  }, 30_000);
  afterAll(() => s?.parar());

  it('antes da data: fica no viveiro, fora da doação', async () => {
    expect(await noCatalogo()).toBe(0);
    expect((await chamar(s, s.admin, 'POST', '/api/crads/manutencao/expirar', { hoje: '2027-02-22' })).dados.lotes).toBe(0);
    expect((await ler('lote_mudas', 'loteliberar0001')).fase_atual).toBe('crescimento');
  });

  it('na data indicada: entra sozinho para doação, com histórico e auditoria', async () => {
    expect((await chamar(s, s.admin, 'POST', '/api/crads/manutencao/expirar', { hoje: '2027-02-23' })).dados.lotes).toBe(1);
    expect(await ler('lote_mudas', 'loteliberar0001')).toMatchObject({ fase_atual: 'pronta', versao: 2 });
    expect((await ler('lote_mudas', 'loteliberar0002')).fase_atual).toBe('crescimento');
    expect(await noCatalogo()).toBe(40);
    const filtro = (f: string) => encodeURIComponent(f);
    const eventos = (await chamar(s, s.admin, 'GET', `/api/collections/evento_lote_mudas/records?filter=${filtro(`lote_mudas_id='loteliberar0001'`)}`)).dados.items;
    expect(eventos).toEqual([expect.objectContaining({ tipo: 'mudanca_fase', fase_nova: 'pronta', viveiro_id: VIV })]);
    const aud = (await chamar(s, s.admin, 'GET', `/api/collections/auditoria/records?filter=${filtro(`acao='liberar_para_doacao'`)}`)).dados.items;
    expect(aud).toEqual([expect.objectContaining({ registro_id: 'loteliberar0001', usuario_id: 'sistema' })]);
    // no dia seguinte não libera de novo
    expect((await chamar(s, s.admin, 'POST', '/api/crads/manutencao/expirar', { hoje: '2027-02-24' })).dados.lotes).toBe(0);
  });
});
