/**
 * Vários celulares e computadores ao mesmo tempo: o servidor não perde nada,
 * não repete código, não reserva mais mudas do que existem e junta as edições
 * de campos diferentes do mesmo cadastro.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV = 'vivconcorrenc01';
const op = (dispositivo: string, p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'tipo'>): Operacao => ({
  op_id: gerarId(),
  registro_id: gerarId(),
  dados: {},
  base: {},
  base_versao: 0,
  criado_no_aparelho_em: new Date().toISOString(),
  dispositivo_id: dispositivo,
  ...p,
});
type Usuario = { id: string; token: string };

describe.skipIf(!temPocketBase)('muitos aparelhos ao mesmo tempo', () => {
  let s: ServidorTeste;
  let admin: Usuario;
  const equipe: Usuario[] = [];
  const especie = gerarId();
  const enviar = (u: Usuario, dispositivo: string, ops: Operacao[]) => chamar(s, u.token, 'POST', '/api/crads/sync/enviar', { dispositivo_id: dispositivo, operacoes: ops });
  const aparelho = (i: number) => `aparelho${String(i).padStart(7, '0')}`;
  const catalogo = async () => ((await chamar(s, '', 'GET', '/api/crads/publico/catalogo')).dados.itens as { especie_id: string; total: number }[]).find((i) => i.especie_id === especie)?.total ?? 0;

  beforeAll(async () => {
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@concorrencia.local', { gestor_geral: true });
    const r = await enviar(admin, aparelho(900), [
      op(aparelho(900), { colecao: 'viveiro', registro_id: VIV, tipo: 'criar', dados: { sigla: 'CON', nome: 'Viveiro Concorrência', ativo: true } }),
      op(aparelho(900), { colecao: 'especie', registro_id: especie, tipo: 'criar', dados: { nome_cientifico: 'Concorrentia simultanea' } }),
    ]);
    expect(r.dados.resultados.every((x: { status: string }) => x.status === 'aplicada')).toBe(true);
    for (let i = 0; i < 10; i++) {
      const u = await criarUsuario(s, `viveirista${i}@concorrencia.local`);
      await enviar(admin, aparelho(900), [op(aparelho(900), { colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: u.id, perfil: 'viveirista', viveiro_id: VIV } })]);
      equipe.push(u);
    }
  }, 60_000);
  afterAll(() => s?.parar());

  it('10 aparelhos cadastram lotes e mudas juntos: nada se perde e nenhum código se repete', async () => {
    const respostas = await Promise.all(
      equipe.map((u, i) => {
        const ops: Operacao[] = [];
        for (let k = 0; k < 5; k++) {
          const lote = gerarId();
          ops.push(op(aparelho(i), { colecao: 'lote_mudas', registro_id: lote, tipo: 'criar', dados: { codigo: `LM-P-AP${i}-${k + 1}`, especie_id: especie, fase_atual: 'pronta', origem: 'estoque_inicial', viveiro_id: VIV } }));
          ops.push(op(aparelho(i), { colecao: 'movimento_estoque_mudas', tipo: 'criar', dados: { lote_mudas_id: lote, tipo: 'entrada', quantidade: 10, data: '2026-10-19', referencia: 'estoque inicial', viveiro_id: VIV } }));
        }
        return enviar(u, aparelho(i), ops);
      }),
    );
    for (const r of respostas) {
      expect(r.status).toBe(200);
      expect(r.dados.resultados.map((x: { status: string }) => x.status)).toEqual(Array(10).fill('aplicada'));
    }
    const lotes = (await chamar(s, s.admin, 'GET', `/api/collections/lote_mudas/records?perPage=500&filter=${encodeURIComponent(`especie_id='${especie}'`)}`)).dados.items as { codigo: string }[];
    expect(lotes).toHaveLength(50);
    expect(new Set(lotes.map((l) => l.codigo)).size).toBe(50); // códigos definitivos únicos
    for (const l of lotes) expect(l.codigo).toMatch(/^LM-\d{4}-I-\d{3}$/);
    expect(await catalogo()).toBe(500);
  }, 60_000);

  it('dois gestores aprovam ao mesmo tempo pedidos que disputam as mesmas mudas: nunca reserva mais do que existe', async () => {
    const parametro = await enviar(admin, aparelho(900), [op(aparelho(900), { colecao: 'parametro', tipo: 'criar', dados: { chave: 'limite_mudas_por_especie', valor: 1000 } })]);
    expect(parametro.dados.resultados[0].status).toBe('aplicada');
    const pedidos: { doacao: string; item: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const [doacao, item, pessoa] = [gerarId(), gerarId(), gerarId()];
      await enviar(admin, aparelho(900), [
        op(aparelho(900), { colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome: `Pedido ${i}` } }),
        op(aparelho(900), { colecao: 'doacao', registro_id: doacao, tipo: 'criar', dados: { codigo: `DO-P-CON-${i}`, solicitante_pessoa_id: pessoa, situacao: 'enviada', viveiro_id: VIV, termo_aceito_em: '2026-10-19', termo_texto: 'aceito' } }),
        op(aparelho(900), { colecao: 'doacao_item', registro_id: item, tipo: 'criar', dados: { doacao_id: doacao, especie_id: especie, qtd_pedida: 200, viveiro_id: VIV } }),
      ]);
      pedidos.push({ doacao, item });
    }
    // 4 pedidos de 200 = 800 mudas para 500 disponíveis, aprovados todos de uma vez
    const r = await Promise.all(pedidos.map((p) => chamar(s, admin.token, 'POST', `/api/crads/doacao/${p.doacao}/analisar`, { itens: [{ item_id: p.item, qtd_aprovada: 200 }] })));
    const aprovados = r.filter((x) => x.status === 200).length;
    expect(aprovados).toBe(2); // 2 × 200 = 400 cabem; o terceiro já não cabe
    for (const x of r.filter((y) => y.status !== 200)) expect(x.dados.message).toMatch(/Faltam/);
    const reservas = (await chamar(s, s.admin, 'GET', `/api/collections/reserva/records?perPage=500`)).dados.items as { quantidade: number; situacao: string }[];
    expect(reservas.filter((x) => x.situacao === 'ativa').reduce((t, x) => t + x.quantidade, 0)).toBe(400);
    expect(await catalogo()).toBe(100);
  }, 60_000);

  it('dois aparelhos editam a mesma matriz ao mesmo tempo: campos diferentes se juntam', async () => {
    const m = gerarId();
    await chamar(s, admin.token, 'POST', '/api/crads/sync/enviar', {
      dispositivo_id: aparelho(900),
      operacoes: [op(aparelho(900), { colecao: 'usuario_viveiro', tipo: 'criar', dados: { usuario_id: equipe[1].id, perfil: 'coletor', viveiro_id: VIV } })],
    });
    const criada = await enviar(equipe[1], aparelho(1), [op(aparelho(1), { colecao: 'matriz', registro_id: m, tipo: 'criar', dados: { codigo: 'MT-P-CON-1', especie_id: especie, grau_certeza: 'provavel', viveiro_id: VIV } })]);
    expect(criada.dados.resultados[0].status).toBe('aplicada');
    // o coletor no celular e o gestor no computador mexem na mesma matriz no mesmo instante
    const [a, b] = await Promise.all([
      enviar(equipe[1], aparelho(1), [op(aparelho(1), { colecao: 'matriz', registro_id: m, tipo: 'alterar', dados: { altura_m: 15 }, base: { altura_m: 0 }, base_versao: 1 })]),
      enviar(admin, aparelho(902), [op(aparelho(902), { colecao: 'matriz', registro_id: m, tipo: 'alterar', dados: { observacao: 'perto da ponte' }, base: { observacao: '' }, base_versao: 1 })]),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.dados.resultados[0].status, b.dados.resultados[0].status]).toEqual(['aplicada', 'aplicada']);
    const final = (await chamar(s, s.admin, 'GET', `/api/collections/matriz/records/${m}`)).dados;
    expect(final).toMatchObject({ altura_m: 15, observacao: 'perto da ponte' });
  }, 60_000);
});
