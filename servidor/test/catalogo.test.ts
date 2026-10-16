import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivcatalogo0001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-11T10:00:00.000Z',
  dispositivo_id: 'aparelho0000009',
  ...p,
});

describe.skipIf(!temPocketBase)('catálogo público no servidor', () => {
  let s: ServidorTeste;
  let especie = '';

  beforeAll(async () => {
    s = await subirServidor();
    const gestor = await criarUsuario(s, 'gestor@catalogo.local', { gestor_geral: true });
    especie = gerarId();
    const [mun, mat, col, ls, lm] = [gerarId(), gerarId(), gerarId(), gerarId(), gerarId()];
    const ops: Operacao[] = [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'CAT', nome: 'Viveiro Catálogo', ativo: true } }),
      op({ colecao: 'municipio', registro_id: mun, tipo: 'criar', dados: { codigo_ibge: '0000000', nome: 'Município Fictício', uf: 'TO' } }),
      op({ colecao: 'especie', registro_id: especie, tipo: 'criar', dados: { nome_cientifico: 'Ficticia publica', familia: 'Ficticiaceae', publicada: false, revisar: true, nota_revisao: 'interno', folha: 'composta' } }),
      op({ colecao: 'nome_popular', tipo: 'criar', dados: { especie_id: especie, nome: 'Árvore-pública' } }),
      op({ colecao: 'matriz', registro_id: mat, tipo: 'criar', dados: { codigo: 'MT-0777', especie_id: especie, grau_certeza: 'certo', situacao_validacao: 'aprovada', lat: -10.5, lon: -48.5, municipio_id: mun, viveiro_id: VIV } }),
      op({ colecao: 'coleta', registro_id: col, tipo: 'criar', dados: { matriz_id: mat, data: '2026-01-10', viveiro_id: VIV } }),
      op({ colecao: 'lote_sementes', registro_id: ls, tipo: 'criar', dados: { codigo: 'LS-2026-777', especie_id: especie, data_formacao: '2026-01-15', viveiro_id: VIV } }),
      op({ colecao: 'lote_sementes_coleta', tipo: 'criar', dados: { lote_sementes_id: ls, coleta_id: col, viveiro_id: VIV } }),
      op({ colecao: 'lote_mudas', registro_id: lm, tipo: 'criar', dados: { codigo: 'LM-2026-777-A', lote_sementes_id: ls, especie_id: especie, data_semeadura: '2026-02-01', fase_atual: 'pronta', viveiro_id: VIV } }),
      op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: lm, tipo: 'entrada', quantidade: 80, data: '2026-03-01', viveiro_id: VIV } }),
    ];
    const r = await chamar(s, gestor.token, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000009', operacoes: ops });
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
    // Reserva só nasce no servidor (na análise do pedido); aqui, direto pelo painel.
    const res = await chamar(s, s.admin, 'POST', '/api/collections/reserva/records', { doacao_item_id: 'x', lote_mudas_id: lm, quantidade: 30, situacao: 'ativa', viveiro_id: VIV });
    expect(res.status).toBe(200);
  }, 30_000);
  afterAll(() => s?.parar());

  // espécie importada da lista oficial entra como não publicada: as mudas prontas aparecem mesmo assim
  it('catálogo sem login, com o disponível já sem as reservas (não precisa publicar a espécie)', async () => {
    const r = await chamar(s, '', 'GET', '/api/crads/publico/catalogo');
    expect(r.status).toBe(200);
    expect(r.dados.itens).toEqual([expect.objectContaining({ nome_cientifico: 'Ficticia publica', nomes_populares: ['Árvore-pública'], total: 50, por_viveiro: [{ viveiro_id: VIV, viveiro: 'Viveiro Catálogo', disponivel: 50 }] })]);
  });

  it('ficha e rastreio públicos sem dados internos, coordenadas ou pessoas', async () => {
    const r = await chamar(s, '', 'GET', `/api/crads/publico/especie/${especie}`);
    expect(r.dados.ficha).toEqual({ id: especie, nome_cientifico: 'Ficticia publica', familia: 'Ficticiaceae', folha: 'composta' });
    expect(r.dados.lotes[0]).toMatchObject({ disponivel: 50, rastreio: { lote_mudas: { codigo: 'LM-2026-777-A' }, lote_sementes: { codigo: 'LS-2026-777', matrizes: 1, municipios: ['Município Fictício'] } } });
    expect(JSON.stringify(r.dados)).not.toMatch(/-10\.5|-48\.5|MT-0777|nota_revisao|interno/);
    const t = await chamar(s, '', 'GET', '/api/crads/publico/rastreio/lm-2026-777-a');
    expect(t.dados.lote_sementes.matrizes).toBe(1);
    expect((await chamar(s, '', 'GET', '/api/crads/publico/rastreio/LM-0000-000-A')).status).toBe(404);
  });

  it('portal de transparência responde sem login e sem dados pessoais', async () => {
    const r = await chamar(s, '', 'GET', '/api/crads/publico/transparencia');
    expect(r.status).toBe(200);
    expect(r.dados).toMatchObject({ mudas_doadas: 0, plantios: [], plantando_agua: { doacoes: 0 } });
  });

  it('espécie que não existe não aparece', async () => {
    expect((await chamar(s, '', 'GET', `/api/crads/publico/especie/${gerarId()}`)).status).toBe(404);
  });
});
