import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gerarId, type Operacao } from '../../dominio/src/index';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

const VIV_PALMAS = 'vivpalmas000001';
const VIV_GURUPI = 'vivgurupi000001';
const DISP = 'aparelho0000001';

function op(p: Partial<Operacao> & Pick<Operacao, 'colecao' | 'registro_id' | 'tipo'>): Operacao {
  return { op_id: gerarId(), dados: {}, base: {}, base_versao: 0, criado_no_aparelho_em: '2026-10-11T10:00:00.000Z', dispositivo_id: DISP, ...p };
}

describe.skipIf(!temPocketBase)('sincronização com o PocketBase de verdade', () => {
  let s: ServidorTeste;
  let gestor: { id: string; token: string };
  let coletor: { id: string; token: string };
  let coletorGurupi: { id: string; token: string };

  const enviar = (token: string, operacoes: Operacao[]) => chamar(s, token, 'POST', '/api/crads/sync/enviar', { dispositivo_id: DISP, operacoes });
  const receber = (token: string, desde = 0) => chamar(s, token, 'GET', `/api/crads/sync/receber?desde=${desde}`);

  beforeAll(async () => {
    s = await subirServidor();
    gestor = await criarUsuario(s, 'gestor@teste.local', { gestor_geral: true });
    coletor = await criarUsuario(s, 'coletor@teste.local');
    coletorGurupi = await criarUsuario(s, 'coletor.gurupi@teste.local');
    // O gestor cadastra os viveiros e os perfis pela própria sincronização.
    const r = await enviar(gestor.token, [
      op({ colecao: 'viveiro', registro_id: VIV_PALMAS, tipo: 'criar', dados: { sigla: 'PAL', nome: 'Viveiro de Palmas', ativo: true } }),
      op({ colecao: 'viveiro', registro_id: VIV_GURUPI, tipo: 'criar', dados: { sigla: 'GUR', nome: 'Viveiro de Gurupi', ativo: true } }),
      op({ colecao: 'usuario_viveiro', registro_id: gerarId(), tipo: 'criar', dados: { usuario_id: coletor.id, perfil: 'coletor', viveiro_id: VIV_PALMAS } }),
      op({ colecao: 'usuario_viveiro', registro_id: gerarId(), tipo: 'criar', dados: { usuario_id: coletorGurupi.id, perfil: 'coletor', viveiro_id: VIV_GURUPI } }),
    ]);
    expect(r.dados.resultados.map((x: { status: string }) => x.status)).toEqual(['aplicada', 'aplicada', 'aplicada', 'aplicada']);
  }, 30_000);

  afterAll(() => s?.parar());

  it('/eu devolve perfis por viveiro', async () => {
    const r = await chamar(s, coletor.token, 'GET', '/api/crads/eu');
    expect(r.dados.perfisPorViveiro).toEqual({ [VIV_PALMAS]: ['coletor'] });
  });

  it('sem login não sincroniza', async () => {
    expect((await receber('')).status).toBe(401);
  });

  it('coletor cria matriz offline, reenvia sem duplicar e o servidor audita', async () => {
    const id = gerarId();
    const criar = op({ colecao: 'matriz', registro_id: id, tipo: 'criar', dados: { codigo: 'MT-P-APAR-1', grau_certeza: 'provavel', viveiro_id: VIV_PALMAS, lat: -10.2, lon: -48.3, respostas_assistente: { folha: 'composta' } } });
    const r1 = await enviar(coletor.token, [criar]);
    expect(r1.dados.resultados[0].status).toBe('aplicada');
    expect(r1.dados.resultados[0].codigo_alterado.para).toBe('MT-0001');
    expect(r1.dados.resultados[0].registro).toMatchObject({ id, versao: 1, codigo: 'MT-0001', respostas_assistente: { folha: 'composta' } });
    const r2 = await enviar(coletor.token, [criar]);
    expect(r2.dados.resultados[0]).toMatchObject({ status: 'aplicada', registro: { codigo: 'MT-0001', versao: 1 } });
    const aud = await chamar(s, s.admin, 'GET', `/api/collections/auditoria/records?filter=${encodeURIComponent(`registro_id='${id}'`)}`);
    expect(aud.dados.items).toHaveLength(1);
    expect(aud.dados.items[0]).toMatchObject({ acao: 'criar', usuario_id: coletor.id, data_aparelho: '2026-10-11T10:00:00.000Z' });
  });

  it('separa por viveiro: o coletor de Gurupi não recebe nem altera matrizes de Palmas', async () => {
    const id = gerarId();
    await enviar(coletor.token, [op({ colecao: 'matriz', registro_id: id, tipo: 'criar', dados: { codigo: 'MT-P-APAR-2', grau_certeza: 'certo', viveiro_id: VIV_PALMAS } })]);
    const recebido = await receber(coletorGurupi.token);
    expect(recebido.dados.registros.some((x: { registro: { id: string } }) => x.registro.id === id)).toBe(false);
    const r = await enviar(coletorGurupi.token, [op({ colecao: 'matriz', registro_id: id, tipo: 'alterar', base_versao: 1, dados: { observacao: 'x' } })]);
    expect(r.dados.resultados[0].status).toBe('rejeitada');
  });

  it('conflito: vale o servidor, o aparelho é avisado e o gestor recebe o conflito', async () => {
    const id = gerarId();
    await enviar(coletor.token, [op({ colecao: 'matriz', registro_id: id, tipo: 'criar', dados: { codigo: 'MT-P-APAR-3', grau_certeza: 'certo', viveiro_id: VIV_PALMAS, observacao: 'original', altura_m: 10 } })]);
    await enviar(gestor.token, [op({ colecao: 'matriz', registro_id: id, tipo: 'alterar', base_versao: 1, dados: { observacao: 'do gestor' }, base: { observacao: 'original' } })]);
    const r = await enviar(coletor.token, [
      op({ colecao: 'matriz', registro_id: id, tipo: 'alterar', base_versao: 1, dados: { observacao: 'do coletor', altura_m: 12 }, base: { observacao: 'original', altura_m: 10 } }),
    ]);
    const res = r.dados.resultados[0];
    expect(res.status).toBe('conflito');
    expect(res.registro).toMatchObject({ observacao: 'do gestor', altura_m: 12, versao: 3 });
    const doGestor = await receber(gestor.token);
    const conflitos = doGestor.dados.registros.filter((x: { colecao: string }) => x.colecao === 'conflito');
    expect(conflitos.at(-1).registro).toMatchObject({ registro_id: id, situacao: 'aberto' });
  });

  it('LGPD: o telefone cadastrado pelo coletor chega ao gestor e some do coletor', async () => {
    const pessoa = gerarId();
    const dp = gerarId();
    await enviar(coletor.token, [
      op({ colecao: 'pessoa', registro_id: pessoa, tipo: 'criar', dados: { nome: 'Proprietário Fictício' } }),
      op({ colecao: 'dados_pessoais', registro_id: dp, tipo: 'criar', dados: { pessoa_id: pessoa, telefone: '63 90000-0000' } }),
    ]);
    const doColetor = (await receber(coletor.token)).dados.registros.find((x: { registro: { id: string } }) => x.registro.id === dp);
    expect(doColetor.registro).toEqual({ id: dp, versao: 1, seq: expect.any(Number), excluido: true });
    const doGestor = (await receber(gestor.token)).dados.registros.find((x: { registro: { id: string } }) => x.registro.id === dp);
    expect(doGestor.registro.telefone).toBe('63 90000-0000');
  });

  it('recebimento é paginado por cursor', async () => {
    const tudo = await receber(gestor.token);
    const meio = tudo.dados.registros[2].registro.seq;
    const resto = await receber(gestor.token, meio);
    expect(resto.dados.registros[0].registro.seq).toBeGreaterThan(meio);
    expect(resto.dados.registros.length).toBe(tudo.dados.registros.length - 3);
  });

  it('reserva faixas de código diferentes para cada aparelho', async () => {
    const a = await chamar(s, coletor.token, 'POST', '/api/crads/sync/faixas', { dispositivo_id: 'aparelhoaaaaaaa', pedidos: [{ tipo: 'MT', quantidade: 10 }] });
    const b = await chamar(s, coletor.token, 'POST', '/api/crads/sync/faixas', { dispositivo_id: 'aparelhobbbbbbb', pedidos: [{ tipo: 'MT', quantidade: 10 }, { tipo: 'LS', ano: 2026, quantidade: 5 }] });
    const fa = a.dados.faixas[0];
    const fb = b.dados.faixas[0];
    expect(fb.inicio).toBe(fa.fim + 1);
    expect(b.dados.faixas[1]).toMatchObject({ tipo: 'LS', ano: 2026, inicio: 1, fim: 5 });
    // código da faixa é aceito como veio
    const r = await enviar(coletor.token, [op({ colecao: 'matriz', registro_id: gerarId(), tipo: 'criar', dados: { codigo: `MT-${String(fa.inicio).padStart(4, '0')}`, grau_certeza: 'certo', viveiro_id: VIV_PALMAS } })]);
    expect(r.dados.resultados[0].codigo_alterado ?? null).toBeNull();
  });

  it('eventos são só-acréscimo', async () => {
    const id = gerarId();
    const dados = { lote_mudas_id: 'lote00000000001', tipo: 'perda', data: '2026-10-01', quantidade: 5, causa: 'formiga', viveiro_id: VIV_PALMAS };
    expect((await enviar(gestor.token, [op({ colecao: 'evento_lote_mudas', registro_id: id, tipo: 'criar', dados })])).dados.resultados[0].status).toBe('aplicada');
    const r = await enviar(gestor.token, [op({ colecao: 'evento_lote_mudas', registro_id: id, tipo: 'alterar', base_versao: 1, dados: { quantidade: 50 } })]);
    expect(r.dados.resultados[0].status).toBe('rejeitada');
  });

  it('envia foto e o registro sobe de seq', async () => {
    const id = gerarId();
    await enviar(coletor.token, [op({ colecao: 'foto', registro_id: id, tipo: 'criar', dados: { entidade: 'matriz', registro_id: 'x', parte: 'folha', viveiro_id: VIV_PALMAS } })]);
    const form = new FormData();
    form.append('arquivo', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'folha.jpg');
    const r = await fetch(`${s.url}/api/crads/arquivo/foto/${id}/arquivo`, { method: 'POST', headers: { authorization: coletor.token }, body: form });
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.registro.arquivo).toMatch(/^folha_.*\.jpg$/);
    // quem pode ler o registro baixa a foto (ex.: gestor no relatório do coletor); de outro viveiro, não
    const baixa = await fetch(`${s.url}/api/crads/arquivo/foto/${id}/arquivo`, { headers: { authorization: gestor.token } });
    expect(baixa.status).toBe(200);
    expect([...new Uint8Array(await baixa.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect((await fetch(`${s.url}/api/crads/arquivo/foto/${id}/arquivo`, { headers: { authorization: coletorGurupi.token } })).status).toBe(404);
    expect((await fetch(`${s.url}/api/crads/arquivo/foto/${id}/arquivo`)).status).toBe(401);
  });

  it('o painel do PocketBase não apaga registros de verdade, e o que muda por lá chega aos aparelhos', async () => {
    const lista = await chamar(s, s.admin, 'GET', '/api/collections/viveiro/records');
    const viv = lista.dados.items.find((v: { id: string }) => v.id === VIV_PALMAS);
    expect((await chamar(s, s.admin, 'DELETE', `/api/collections/viveiro/records/${VIV_PALMAS}`)).status).toBe(400);
    const antes = (await receber(coletor.token)).dados.cursor;
    await chamar(s, s.admin, 'PATCH', `/api/collections/viveiro/records/${VIV_PALMAS}`, { nome: 'Viveiro Central de Palmas' });
    const depois = await receber(coletor.token, antes);
    expect(depois.dados.registros[0].registro).toMatchObject({ id: VIV_PALMAS, nome: 'Viveiro Central de Palmas', versao: viv.versao + 1 });
  });
});
