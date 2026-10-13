import { describe, expect, it } from 'vitest';
import { indicadores, montarTransparencia, rastrearCadeia, type DadosRelatorio } from '../src/relatorios';

// Uma cadeia completa em dois viveiros (dados fictícios).
const d: DadosRelatorio = {
  viveiros: [{ id: 'pal', nome: 'Palmas' }, { id: 'gur', nome: 'Gurupi' }],
  especies: [{ id: 'ipe', nome_cientifico: 'Ficticia aurea' }, { id: 'treino', nome_cientifico: 'Treino', ficticia: true }],
  nomesPopulares: [{ id: 'n', especie_id: 'ipe', nome: 'Ipê-de-teste' }],
  matrizes: [
    { id: 'm1', codigo: 'MT-0001', viveiro_id: 'pal', especie_id: 'ipe', situacao_validacao: 'aprovada', criado_no_aparelho_em: '2026-01-05' },
    { id: 'm2', codigo: 'MT-0002', viveiro_id: 'pal', especie_id: 'ipe', situacao_validacao: 'pendente', criado_no_aparelho_em: '2026-01-06' },
    { id: 'm3', codigo: 'MT-0003', viveiro_id: 'gur', especie_id: 'ipe', situacao_validacao: 'aprovada', criado_no_aparelho_em: '2025-06-01' },
  ],
  coletas: [
    { id: 'c1', viveiro_id: 'pal', matriz_id: 'm1', data: '2026-02-01', quantidade: 2, unidade: 'kg' },
    { id: 'c2', viveiro_id: 'pal', matriz_id: 'm1', data: '2026-02-10', quantidade: 500, unidade: 'g' },
    { id: 'c3', viveiro_id: 'gur', matriz_id: 'm3', data: '2026-02-11', quantidade: 30, unidade: 'frutos' },
  ],
  lotesSementes: [{ id: 'ls1', codigo: 'LS-2026-001', viveiro_id: 'pal', especie_id: 'ipe' }],
  ligacoes: [{ id: 'g1', lote_sementes_id: 'ls1', coleta_id: 'c1' }, { id: 'g2', lote_sementes_id: 'ls1', coleta_id: 'c2' }],
  movSementes: [
    { id: 'ms1', lote_sementes_id: 'ls1', tipo: 'entrada', quantidade_g: 800 },
    { id: 'ms2', lote_sementes_id: 'ls1', tipo: 'semeadura', quantidade_g: 100 },
  ],
  lotesMudas: [{ id: 'lm1', codigo: 'LM-2026-001-A', viveiro_id: 'pal', lote_sementes_id: 'ls1', especie_id: 'ipe', data_semeadura: '2026-03-01', sementes_semeadas: 200, fase_atual: 'pronta' }],
  eventosMudas: [
    { id: 'e1', lote_mudas_id: 'lm1', tipo: 'contagem_germinacao', quantidade: 120 },
    { id: 'e2', lote_mudas_id: 'lm1', tipo: 'contagem_germinacao', quantidade: 150 },
  ],
  movMudas: [
    { id: 'mm1', lote_mudas_id: 'lm1', tipo: 'entrada', quantidade: 150, data: '2026-03-20' },
    { id: 'mm2', lote_mudas_id: 'lm1', tipo: 'perda', quantidade: 10, data: '2026-04-01' },
    { id: 'mm3', lote_mudas_id: 'lm1', tipo: 'saida_doacao', quantidade: 40, data: '2026-08-01' },
  ],
  doacoes: [
    { id: 'd1', codigo: 'DO-2026-001', viveiro_id: 'pal', situacao: 'retirada', criado_no_aparelho_em: '2026-07-01' },
    { id: 'd2', codigo: 'DO-2026-002', viveiro_id: 'pal', situacao: 'enviada', criado_no_aparelho_em: '2026-07-02' },
  ],
  doacaoItens: [
    { id: 'i1', doacao_id: 'd1', especie_id: 'ipe', qtd_pedida: 50, qtd_aprovada: 40, qtd_entregue: 40 },
    { id: 'i2', doacao_id: 'd2', especie_id: 'ipe', qtd_pedida: 10 },
  ],
  doacaoItemLotes: [{ id: 'il1', doacao_item_id: 'i1', lote_mudas_id: 'lm1', quantidade: 40 }],
  historicoProgramas: [{ id: 'h1', doacao_id: 'd1', programa_id: 'plantandoagua01', acao: 'marcou', criado_no_aparelho_em: '2026-07-01' }],
  plantios: [{ id: 'p1', doacao_id: 'd1', viveiro_id: 'pal', data: '2026-08-05', geometria: { type: 'Point', coordinates: [-48.33456, -10.18456] } }],
  plantioItens: [{ id: 'pi1', plantio_id: 'p1', especie_id: 'ipe', quantidade: 40 }],
  monitoramentos: [{ id: 'mo1', plantio_id: 'p1', data: '2026-09-01', tipo: 'relato' }],
  monitoramentoItens: [{ id: 'mi1', monitoramento_id: 'mo1', especie_id: 'ipe', vivas: 34 }],
};

describe('indicadores', () => {
  it('somando todos os viveiros', () => {
    const r = indicadores(d);
    expect(r.matrizes).toEqual({ total: 3, ativas: 3, especies: 1 });
    expect(r.coletas).toEqual({ total: 3, kg: 2.5, matrizes: 2 });
    expect(r.sementes).toEqual({ lotes: 1, estoque_g: 700 });
    expect(r.mudas).toMatchObject({ semeadas: 200, germinadas: 150, taxa_germinacao: 75, perdas: 10, prontas: 100 });
    expect(r.doacoes).toEqual({ pedidos: 2, em_analise: 1, mudas_pedidas: 60, mudas_entregues: 40, programa: 1 });
    expect(r.plantio).toEqual({ plantios: 1, plantadas: 40, vivas: 34, sobrevivencia: 85 });
  });
  it('por viveiro e por período', () => {
    expect(indicadores(d, { viveiros: ['gur'] }).matrizes.total).toBe(1);
    expect(indicadores(d, { inicio: '2026-01-01', fim: '2026-12-31' }).matrizes.total).toBe(2);
    expect(indicadores(d, { inicio: '2026-02-05', fim: '2026-02-28' }).coletas).toEqual({ total: 2, kg: 0.5, matrizes: 2 });
  });
  it('Plantando Água é um recorte das doações', () => {
    const p = indicadores(d, { programaId: 'plantandoagua01' });
    expect(p.doacoes).toMatchObject({ pedidos: 1, mudas_entregues: 40 });
    expect(indicadores(d).doacoes.pedidos).toBe(2);
  });
});

describe('rastreio completo', () => {
  it('da muda plantada (doação) volta às matrizes', () => {
    const c = rastrearCadeia('do-2026-001', d)!;
    expect(c.matrizes.map((m) => m.codigo)).toEqual(['MT-0001']);
    expect(c.lotesSementes.map((l) => l.codigo)).toEqual(['LS-2026-001']);
    expect(c.lotesMudas.map((l) => l.codigo)).toEqual(['LM-2026-001-A']);
    expect(c.plantios.map((p) => p.id)).toEqual(['p1']);
  });
  it('da matriz vai até os plantios', () => {
    const c = rastrearCadeia('MT-0001', d)!;
    expect(c.doacoes.map((x) => x.codigo)).toEqual(['DO-2026-001']);
    expect(c.plantios).toHaveLength(1);
    expect(rastrearCadeia('MT-0003', d)!.doacoes).toEqual([]);
    expect(rastrearCadeia('XX-1', d)).toBeNull();
  });
});

describe('portal público', () => {
  it('totais, espécies e mapa com pontos arredondados, sem dados pessoais', () => {
    const t = montarTransparencia(d);
    expect(t).toMatchObject({
      mudas_doadas: 40,
      mudas_plantadas: 40,
      sobrevivencia: 85,
      doacoes: 1,
      plantando_agua: { doacoes: 1, mudas_doadas: 40 },
      especies_mais_distribuidas: [{ especie: 'Ipê-de-teste', mudas: 40 }],
      plantios: [{ lat: -10.18, lon: -48.33, mudas: 40, ano: '2026' }],
      por_ano: [{ ano: '2026', mudas_doadas: 40 }],
    });
    expect(JSON.stringify(t)).not.toMatch(/DO-2026|MT-|10\.1845|48\.3345/);
  });
});

describe('rastreio a partir da doação', () => {
  it('não traz lotes irmãos que saíram do mesmo lote de sementes', () => {
    const v = { viveiro_id: 'v1' };
    const d = {
      viveiros: [], especies: [], nomesPopulares: [], movSementes: [], eventosMudas: [], movMudas: [], historicoProgramas: [], plantioItens: [], monitoramentos: [], monitoramentoItens: [], plantios: [],
      matrizes: [{ id: 'm1', codigo: 'MT-1', ...v }],
      coletas: [{ id: 'c1', matriz_id: 'm1', ...v }],
      lotesSementes: [{ id: 's1', codigo: 'LS-2026-001', ...v }],
      ligacoes: [{ id: 'g1', lote_sementes_id: 's1', coleta_id: 'c1' }],
      lotesMudas: [{ id: 'a', codigo: 'LM-2026-001-A', lote_sementes_id: 's1' }, { id: 'b', codigo: 'LM-2026-001-B', lote_sementes_id: 's1' }],
      doacoes: [{ id: 'd1', codigo: 'DO-2026-001' }],
      doacaoItens: [{ id: 'i1', doacao_id: 'd1' }],
      doacaoItemLotes: [{ id: 'x1', doacao_item_id: 'i1', lote_mudas_id: 'a' }],
    };
    const c = rastrearCadeia('DO-2026-001', d)!;
    expect(c.lotesMudas.map((l) => l.codigo)).toEqual(['LM-2026-001-A']);
    expect(c.matrizes.map((m) => m.codigo)).toEqual(['MT-1']);
    const s = rastrearCadeia('LS-2026-001', d)!;
    expect(s.lotesMudas).toHaveLength(2);
    expect(s.doacoes).toHaveLength(1);
  });
});
