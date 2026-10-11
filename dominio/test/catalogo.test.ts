import { describe, expect, it } from 'vitest';
import { fichaPublica, montarCatalogo, montarRastreio } from '../src/catalogo';

const base = {
  especies: [
    { id: 'ipe', nome_cientifico: 'Ficticia aurea', familia: 'Ficticiaceae', publicada: true },
    { id: 'baru', nome_cientifico: 'Ficticia baru', publicada: false },
    { id: 'treino', nome_cientifico: 'Ficticia treino', publicada: true, ficticia: true },
  ],
  nomesPopulares: [{ id: 'n1', especie_id: 'ipe', nome: 'Ipê-de-teste' }],
  viveiros: [
    { id: 'pal', nome: 'Palmas' },
    { id: 'gur', nome: 'Gurupi' },
  ],
  lotesMudas: [
    { id: 'l1', especie_id: 'ipe', viveiro_id: 'pal', fase_atual: 'pronta' },
    { id: 'l2', especie_id: 'ipe', viveiro_id: 'gur', fase_atual: 'pronta' },
    { id: 'l3', especie_id: 'ipe', viveiro_id: 'pal', fase_atual: 'crescimento' },
    { id: 'l4', especie_id: 'baru', viveiro_id: 'pal', fase_atual: 'pronta' },
    { id: 'l5', especie_id: 'treino', viveiro_id: 'pal', fase_atual: 'pronta' },
  ],
  movimentos: [
    { id: 'm1', lote_mudas_id: 'l1', tipo: 'entrada', quantidade: 100 },
    { id: 'm2', lote_mudas_id: 'l1', tipo: 'perda', quantidade: 10 },
    { id: 'm3', lote_mudas_id: 'l2', tipo: 'entrada', quantidade: 40 },
    { id: 'm4', lote_mudas_id: 'l3', tipo: 'entrada', quantidade: 500 },
    { id: 'm5', lote_mudas_id: 'l4', tipo: 'entrada', quantidade: 50 },
    { id: 'm6', lote_mudas_id: 'l5', tipo: 'entrada', quantidade: 50 },
  ],
  reservas: [
    { id: 'r1', lote_mudas_id: 'l1', quantidade: 30, situacao: 'ativa' },
    { id: 'r2', lote_mudas_id: 'l1', quantidade: 999, situacao: 'expirada' },
    { id: 'r3', lote_mudas_id: 'l2', quantidade: 40, situacao: 'ativa' },
  ],
  fotos: [
    { id: 'f1', especie_id: 'ipe', parte: 'folha', arquivo: 'folha.jpg', miniatura: 'folha-mini.jpg' },
    { id: 'f2', especie_id: 'ipe', parte: 'muda', arquivo: 'muda.jpg', miniatura: 'muda-mini.jpg' },
  ],
};

describe('catálogo público', () => {
  it('só mudas prontas, de espécies publicadas (e não fictícias), sem as reservas', () => {
    expect(montarCatalogo(base)).toEqual([
      {
        especie_id: 'ipe',
        nome_cientifico: 'Ficticia aurea',
        familia: 'Ficticiaceae',
        nomes_populares: ['Ipê-de-teste'],
        por_viveiro: [{ viveiro_id: 'pal', viveiro: 'Palmas', disponivel: 60 }],
        total: 60,
        foto: { id: 'f2', arquivo: 'muda.jpg', miniatura: 'muda-mini.jpg', parte: 'muda' },
      },
    ]);
  });

  it('ficha pública não leva campos internos', () => {
    expect(fichaPublica({ id: 'x', nome_cientifico: 'F. a', revisar: true, nota_revisao: 'x', flora_id: '1', sementes_por_kg: 0, folha: 'composta' })).toEqual({ id: 'x', nome_cientifico: 'F. a', folha: 'composta' });
  });
});

describe('rastreio público', () => {
  it('mostra nº de matrizes e municípios, nunca coordenada, proprietário ou coletor', () => {
    const r = montarRastreio(
      { id: 'lm', codigo: 'LM-2026-001-A', viveiro_id: 'pal', lote_sementes_id: 'ls', data_semeadura: '2026-03-01', fase_atual: 'pronta' },
      {
        viveiros: base.viveiros,
        lotesSementes: [{ id: 'ls', codigo: 'LS-2026-001', data_formacao: '2026-02-20' }],
        ligacoes: [
          { id: 'a', lote_sementes_id: 'ls', coleta_id: 'c1' },
          { id: 'b', lote_sementes_id: 'ls', coleta_id: 'c2' },
          { id: 'c', lote_sementes_id: 'ls', coleta_id: 'c3' },
        ],
        coletas: [
          { id: 'c1', matriz_id: 'm1' },
          { id: 'c2', matriz_id: 'm2' },
          { id: 'c3', matriz_id: 'm1' },
        ],
        matrizes: [
          { id: 'm1', municipio_id: 'mun1', lat: -10, lon: -48, proprietario_pessoa_id: 'p' },
          { id: 'm2', municipio_id: 'mun2', lat: -11, lon: -48 },
        ],
        municipios: [
          { id: 'mun1', nome: 'Palmas' },
          { id: 'mun2', nome: 'Porto Nacional' },
        ],
      },
    );
    expect(r).toEqual({
      lote_mudas: { codigo: 'LM-2026-001-A', viveiro: 'Palmas', data_semeadura: '2026-03-01', fase: 'pronta' },
      lote_sementes: { codigo: 'LS-2026-001', data_formacao: '2026-02-20', matrizes: 2, municipios: ['Palmas', 'Porto Nacional'] },
    });
    expect(JSON.stringify(r)).not.toMatch(/lat|lon|proprietario/);
  });
});
