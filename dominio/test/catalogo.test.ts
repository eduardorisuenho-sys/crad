import { describe, expect, it } from 'vitest';
import { saldoMudas } from '../src/viveiro';
import { diagnosticoCatalogo, fichaPublica, montarCatalogo, montarRastreio, resumoCatalogo } from '../src/catalogo';

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
  it('só mudas prontas, de qualquer espécie (publicada ou não), sem as reservas', () => {
    // em ordem alfabética do nome
    expect(montarCatalogo(base).map((i) => i.especie_id)).toEqual(['baru', 'treino', 'ipe']);
    expect([...montarCatalogo(base)].sort((a, b) => ['baru', 'ipe', 'treino'].indexOf(a.especie_id) - ['baru', 'ipe', 'treino'].indexOf(b.especie_id))).toEqual([
      {
        especie_id: 'baru',
        nome_cientifico: 'Ficticia baru',
        familia: '',
        nomes_populares: [],
        por_viveiro: [{ viveiro_id: 'pal', viveiro: 'Palmas', disponivel: 50 }],
        total: 50,
        foto: undefined,
      },
      {
        especie_id: 'ipe',
        nome_cientifico: 'Ficticia aurea',
        familia: 'Ficticiaceae',
        nomes_populares: ['Ipê-de-teste'],
        por_viveiro: [{ viveiro_id: 'pal', viveiro: 'Palmas', disponivel: 60 }],
        total: 60,
        foto: { id: 'f2', arquivo: 'muda.jpg', miniatura: 'muda-mini.jpg', parte: 'muda' },
      },
      {
        especie_id: 'treino',
        nome_cientifico: 'Ficticia treino',
        familia: '',
        nomes_populares: [],
        por_viveiro: [{ viveiro_id: 'pal', viveiro: 'Palmas', disponivel: 50 }],
        total: 50,
        foto: undefined,
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

describe('diagnóstico: por que a muda não aparece no catálogo', () => {
  const especies = [
    { id: 'ok', nome_cientifico: 'A' },
    { id: 'fic', nome_cientifico: 'B', ficticia: true },
    { id: 'form', nome_cientifico: 'C' },
    { id: 'res', nome_cientifico: 'D' },
    { id: 'novo', nome_cientifico: 'E' },
    { id: 'serv', nome_cientifico: 'F' },
  ];
  const lotesMudas = [
    { id: 'l-ok', codigo: 'LM-1', especie_id: 'ok', fase_atual: 'pronta', versao: 2 },
    { id: 'l-fic', codigo: 'LM-2', especie_id: 'fic', fase_atual: 'pronta', versao: 2 },
    { id: 'l-form', codigo: 'LM-3', especie_id: 'form', fase_atual: 'crescimento', versao: 2 },
    { id: 'l-res', codigo: 'LM-4', especie_id: 'res', fase_atual: 'pronta', versao: 2 },
    { id: 'l-novo', codigo: 'LM-P-X-1', especie_id: 'novo', fase_atual: 'pronta', versao: 0 },
    { id: 'l-serv', codigo: 'LM-6', especie_id: 'serv', fase_atual: 'pronta', versao: 2 },
    { id: 'l-vazio', codigo: 'LM-7', especie_id: 'serv', fase_atual: 'pronta', versao: 2 },
  ];
  const movimentos = lotesMudas.filter((l) => l.id !== 'l-vazio').map((l, i) => ({ id: `m${i}`, lote_mudas_id: l.id, tipo: 'entrada', quantidade: 10, versao: l.versao }));
  const reservas = [{ id: 'r', lote_mudas_id: 'l-res', quantidade: 10, situacao: 'ativa' }];
  const d = { especies, lotesMudas, movimentos, reservas };

  it('dá o motivo de cada lote com mudas que não está no catálogo', () => {
    const r = diagnosticoCatalogo(d, new Set(['ok', 'fic']), 3);
    expect(Object.fromEntries(r.map((x) => [x.codigo, x.motivo]))).toEqual({
      'LM-3': 'em_formacao',
      'LM-4': 'reservadas',
      'LM-P-X-1': 'nao_enviado',
      'LM-6': 'servidor',
    });
  });

  it('servidor sem as regras novas: avisa que precisa atualizar', () => {
    // servidor antigo (regras 2): esta ainda não aparecia lá
    const r = diagnosticoCatalogo(d, new Set(['ok']), 2);
    expect(r.find((x) => x.codigo === 'LM-2')?.motivo).toBe('servidor_desatualizado');
    expect(r.find((x) => x.codigo === 'LM-6')?.motivo).toBe('servidor_desatualizado');
  });
});

describe('resumo do catálogo no servidor (explica o catálogo vazio)', () => {
  it('conta os lotes por situação', () => {
    expect(resumoCatalogo(base)).toMatchObject({ lotes: 5, no_catalogo: 3, em_formacao: 1, reservadas: 1, sem_entrada: 0, esgotado: 0, sem_especie: 0 });
  });

  it('separa lote sem entrada de mudas, esgotado e de espécie apagada (pelo código)', () => {
    const r = resumoCatalogo({
      especies: [{ id: 'a' }, { id: 'apagada', excluido: true }],
      lotesMudas: [
        { id: 'l1', codigo: 'LM-1', especie_id: 'a', fase_atual: 'pronta' },
        { id: 'l2', codigo: 'LM-2', especie_id: 'a', fase_atual: 'pronta' },
        { id: 'l3', codigo: 'LM-3', especie_id: 'apagada', fase_atual: 'pronta' },
      ],
      movimentos: [
        { id: 'm1', lote_mudas_id: 'l2', tipo: 'entrada', quantidade: 5 },
        { id: 'm2', lote_mudas_id: 'l2', tipo: 'saida_doacao', quantidade: 5 },
        { id: 'm3', lote_mudas_id: 'l3', tipo: 'entrada', quantidade: 9 },
      ],
      reservas: [],
    });
    expect(r).toMatchObject({ lotes: 3, sem_entrada: 1, esgotado: 1, sem_especie: 1, no_catalogo: 0 });
    expect(r.fora).toEqual([
      { codigo: 'LM-1', situacao: 'sem_entrada' },
      { codigo: 'LM-2', situacao: 'esgotado' },
      { codigo: 'LM-3', situacao: 'sem_especie' },
    ]);
  });
});

describe('diagnóstico cruzado com o servidor', () => {
  const especies = [{ id: 'a' }];
  const lote = (id: string, extra = {}) => ({ id, codigo: id.toUpperCase(), especie_id: 'a', fase_atual: 'pronta', versao: 2, ...extra });
  const entrada = (l: string, extra = {}) => ({ id: `m-${l}`, lote_mudas_id: l, tipo: 'entrada', quantidade: 10, versao: 2, ...extra });

  it('recusado pelo servidor, sem entrada no servidor, espécie apagada e esgotado', () => {
    const d = {
      especies,
      lotesMudas: [lote('r'), lote('s'), lote('e'), lote('x')],
      movimentos: [entrada('r', { _rejeitado: true }), entrada('s'), entrada('e'), entrada('x')],
      reservas: [],
    };
    const noServidor = new Map([['S', 'sem_entrada'], ['E', 'sem_especie'], ['X', 'esgotado']]);
    const r = diagnosticoCatalogo(d, new Set(), 3, noServidor);
    expect(Object.fromEntries(r.map((x) => [x.codigo, x.motivo]))).toEqual({ R: 'recusado', S: 'sem_entrada_no_servidor', E: 'especie_apagada', X: 'esgotado_no_servidor' });
  });

  it('o que o servidor recusou não entra no saldo', () => {
    expect(saldoMudas([{ tipo: 'entrada', quantidade: 10, _rejeitado: true }, { tipo: 'entrada', quantidade: 3 }])).toBe(3);
  });
});
