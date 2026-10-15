import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivlote00000001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-15T10:00:00.000Z',
  dispositivo_id: 'aparelho0000070',
  ...p,
});

describe.skipIf(!temPocketBase)('lote de sementes automático', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let coletor: { id: string; token: string };
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000070', operacoes: ops });
  const ler = async (col: string) => (await chamar(s, s.admin, 'GET', `/api/collections/${col}/records?perPage=200`)).dados.items as Record<string, unknown>[];

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@lote.local', { gestor_geral: true });
    coletor = await criarUsuario(s, 'col@lote.local');
    await enviar(admin.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'LOT', nome: 'Viveiro Lote', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIV } }),
      op({ colecao: 'especie', registro_id: 'esploteauto0001', tipo: 'criar', dados: { nome_cientifico: 'Lotia automatica' } }),
    ]);
  });
  afterAll(() => s?.parar());

  it('cada coleta vira um lote sozinha, ligado à coleta (rastreável até a matriz); sem espécie, espera a identificação', async () => {
    const m1 = gerarId();
    const m2 = gerarId();
    const c1 = gerarId();
    const c2 = gerarId();
    const c3 = gerarId();
    const r = await enviar(coletor.token, [
      op({ colecao: 'matriz', registro_id: m1, tipo: 'criar', dados: { codigo: 'MT-P-LOT-1', especie_id: 'esploteauto0001', grau_certeza: 'certo', viveiro_id: VIV } }),
      op({ colecao: 'matriz', registro_id: m2, tipo: 'criar', dados: { codigo: 'MT-P-LOT-2', grau_certeza: 'a_identificar', viveiro_id: VIV } }),
      op({ colecao: 'coleta', registro_id: c1, tipo: 'criar', dados: { matriz_id: m1, data: '2026-10-15', material: 'semente', quantidade: 0.5, unidade: 'kg', viveiro_id: VIV } }),
      op({ colecao: 'coleta', registro_id: c2, tipo: 'criar', dados: { matriz_id: m2, data: '2026-10-15', material: 'fruto', quantidade: 3, unidade: 'kg', viveiro_id: VIV } }),
      op({ colecao: 'coleta', registro_id: c3, tipo: 'criar', dados: { especie_id: 'esploteauto0001', data: '2026-10-15', material: 'fruto', quantidade: 2, unidade: 'kg', viveiro_id: VIV } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);

    const ligacoes = await ler('lote_sementes_coleta');
    const loteDe = (c: string) => ligacoes.find((l) => l.coleta_id === c)?.lote_sementes_id;
    expect(loteDe(c1)).toBeTruthy();
    expect(loteDe(c3)).toBeTruthy();
    expect(loteDe(c2)).toBeUndefined(); // matriz ainda sem espécie
    const lotes = await ler('lote_sementes');
    const l1 = lotes.find((l) => l.id === loteDe(c1))!;
    expect(l1).toMatchObject({ especie_id: 'esploteauto0001', origem: 'coleta', peso_g: 500, data_formacao: expect.stringMatching(/^2026-10-15/) });
    expect(String(l1.codigo)).toMatch(/^LS-2026-\d{3}$/);
    const movs = await ler('movimento_sementes');
    expect(movs.filter((m) => m.lote_sementes_id === l1.id)).toEqual([expect.objectContaining({ tipo: 'entrada', quantidade_g: 500 })]);
    expect(String(lotes.find((l) => l.id === loteDe(c3))!.observacao_origem)).toMatch(/frutos: 2 kg.*pesar as sementes limpas/);

    // a matriz é identificada: a coleta dela ganha o lote
    const mat = (await chamar(s, s.admin, 'GET', `/api/collections/matriz/records/${m2}`)).dados;
    await enviar(coletor.token, [op({ colecao: 'matriz', registro_id: m2, tipo: 'alterar', dados: { especie_id: 'esploteauto0001', grau_certeza: 'certo' }, base: { especie_id: '' }, base_versao: mat.versao })]);
    await expect.poll(async () => (await ler('lote_sementes_coleta')).some((l) => l.coleta_id === c2)).toBe(true);

    // os aparelhos recebem os lotes na sincronização
    const rec = (await chamar(s, coletor.token, 'GET', '/api/crads/sync/receber?desde=0&limite=2000')).dados.registros as { colecao: string }[];
    expect(rec.filter((x) => x.colecao === 'lote_sementes').length).toBe(3);
  });
});
