import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivestoque00001';
const op = (p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: '2026-10-12T10:00:00.000Z',
  dispositivo_id: 'aparelho0000030',
  ...p,
});

describe.skipIf(!temPocketBase)('estoque inicial no servidor', () => {
  let s: ServidorTeste;
  let gestor: { id: string; token: string };
  let viveirista: { id: string; token: string };
  let coletor: { id: string; token: string };
  const especie = gerarId();
  const enviar = (t: string, ops: Operacao[]) => chamar(s, t, 'POST', '/api/crads/sync/enviar', { dispositivo_id: 'aparelho0000030', operacoes: ops });

  beforeAll(async () => {
    s = await subirServidor();
    gestor = await criarUsuario(s, 'gestor@estoque.local', { gestor_geral: true });
    viveirista = await criarUsuario(s, 'viveirista@estoque.local');
    coletor = await criarUsuario(s, 'coletor@estoque.local');
    await enviar(gestor.token, [
      op({ colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'EST', nome: 'Viveiro Estoque', ativo: true } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: viveirista.id, perfil: 'viveirista', viveiro_id: VIV } }),
      op({ colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIV } }),
      op({ colecao: 'especie', registro_id: especie, tipo: 'criar', dados: { nome_cientifico: 'Estoquia demonstrativa', publicada: true } }),
    ]);
  });
  afterAll(() => s?.parar());

  it('viveirista cadastra mudas que já existiam: ganha código LM-AAAA-I-NNN, entra no catálogo e o rastreio diz a verdade', async () => {
    const lotes = [gerarId(), gerarId()];
    const r = await enviar(viveirista.token, [
      ...lotes.flatMap((id, i) => [
        op({ colecao: 'lote_mudas', registro_id: id, tipo: 'criar', dados: { codigo: `LM-P-ABCD-${i + 1}`, origem: 'estoque_inicial', especie_id: especie, fase_atual: 'pronta', viveiro_id: VIV } }),
        op({ colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: id, tipo: 'entrada', quantidade: 30 + i, data: '2026-10-12', referencia: 'estoque inicial', viveiro_id: VIV } }),
      ]),
    ]);
    expect(r.dados.resultados.map((x: { status: string }) => x.status)).toEqual(['aplicada', 'aplicada', 'aplicada', 'aplicada']);
    expect([r.dados.resultados[0].registro.codigo, r.dados.resultados[2].registro.codigo]).toEqual(['LM-2026-I-001', 'LM-2026-I-002']);
    const cat = (await chamar(s, '', 'GET', '/api/crads/publico/catalogo')).dados.itens;
    expect(cat[0].total).toBe(61);
    const rastreio = (await chamar(s, '', 'GET', '/api/crads/publico/rastreio/LM-2026-I-001')).dados;
    expect(rastreio.lote_mudas).toMatchObject({ codigo: 'LM-2026-I-001', estoque_inicial: true });
    expect(rastreio.lote_sementes).toBeUndefined();
  });

  it('coletor não cadastra estoque inicial; semeadura sem lote de sementes é recusada', async () => {
    const c = await enviar(coletor.token, [op({ colecao: 'lote_mudas', tipo: 'criar', dados: { codigo: 'LM-P-ABCD-9', origem: 'estoque_inicial', especie_id: especie, fase_atual: 'pronta', viveiro_id: VIV } })]);
    expect(c.dados.resultados[0].status).toBe('rejeitada');
    const v = await enviar(viveirista.token, [op({ colecao: 'lote_mudas', tipo: 'criar', dados: { codigo: 'LM-P-ABCD-8', especie_id: especie, fase_atual: 'semeadura', viveiro_id: VIV } })]);
    expect(v.dados.resultados[0].motivo).toMatch(/lote de sementes/);
  });
});
