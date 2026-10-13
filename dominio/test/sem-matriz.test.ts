/** Sementes sem matriz cadastrada: coleta só com a espécie e sementes que já estavam no viveiro. */
import { describe, expect, it } from 'vitest';
import { montarCatalogo, montarRastreio } from '../src/catalogo';
import { colecao } from '../src/esquema';
import { violacaoRegra } from '../src/regras-escrita';
import { verificarLote } from '../src/sementes';
import type { MatrizResumo } from '../src/index';
import type { ContextoUsuario } from '../src/acesso';

const coletor: ContextoUsuario = { id: 'c', gestorGeral: false, solicitante: false, perfisPorViveiro: { v: ['coletor'] } };

describe('coleta de árvore sem matriz cadastrada', () => {
  it('precisa da matriz ou da espécie', () => {
    expect(violacaoRegra(colecao('coleta'), null, { viveiro_id: 'v', data: '2026-10-13' }, coletor)).toMatch(/matriz ou/);
    expect(violacaoRegra(colecao('coleta'), null, { viveiro_id: 'v', data: '2026-10-13', especie_id: 'e1' }, coletor)).toBeNull();
    expect(colecao('coleta').campos.find((c) => c.nome === 'matriz_id')?.obrigatorio).toBeFalsy();
  });

  it('entra no lote da mesma espécie com um alerta (e não conta como matriz)', () => {
    const matrizes = new Map<string, MatrizResumo>([['m1', { id: 'm1', codigo: 'MT-0001', especie_id: 'e1', situacao_validacao: 'aprovada', grau_certeza: 'certo' } as MatrizResumo]]);
    const r = verificarLote('e1', [{ id: 'c1', matriz_id: 'm1' }, { id: 'c2', matriz_id: null, especie_id: 'e1' }], matrizes, new Set(), 2);
    expect(r.bloqueios).toEqual([]);
    expect(r.matrizes).toBe(1);
    expect(r.alertas.join(' ')).toMatch(/1 coleta\(s\) de árvore sem matriz/);
    expect(verificarLote('e1', [{ id: 'c3', especie_id: 'e2' }], matrizes, new Set(), 1).bloqueios[0]).toMatch(/outra espécie/);
  });

  it('rastreio público conta as coletas sem matriz e marca as sementes que já estavam no viveiro', () => {
    const base = { viveiros: [{ id: 'v', nome: 'Viveiro' }], matrizes: [{ id: 'm1', municipio_id: 'mu' }], municipios: [{ id: 'mu', nome: 'Palmas' }] };
    const lm = { id: 'lm', codigo: 'LM-2026-001-A', viveiro_id: 'v', lote_sementes_id: 'ls', fase_atual: 'pronta' };
    const r = montarRastreio(lm, {
      ...base,
      lotesSementes: [{ id: 'ls', codigo: 'LS-2026-001' }],
      ligacoes: [{ id: 'g1', lote_sementes_id: 'ls', coleta_id: 'c1' }, { id: 'g2', lote_sementes_id: 'ls', coleta_id: 'c2' }],
      coletas: [{ id: 'c1', matriz_id: 'm1' }, { id: 'c2', especie_id: 'e1' }],
    });
    expect(r.lote_sementes).toMatchObject({ matrizes: 1, arvores_sem_matriz: 1, municipios: ['Palmas'] });
    const ini = montarRastreio(lm, { ...base, lotesSementes: [{ id: 'ls', codigo: 'LS-2026-002', origem: 'estoque_inicial' }], ligacoes: [], coletas: [] });
    expect(ini.lote_sementes).toMatchObject({ matrizes: 0, estoque_inicial: true });
  });
});

describe('fotos das mudas no catálogo', () => {
  it('a foto das mudas vem marcada para a rota pública própria', () => {
    const itens = montarCatalogo({
      especies: [{ id: 'e1', nome_cientifico: 'Teste', publicada: true }],
      nomesPopulares: [],
      viveiros: [{ id: 'v', nome: 'V' }],
      lotesMudas: [{ id: 'l1', especie_id: 'e1', viveiro_id: 'v', fase_atual: 'pronta' }],
      movimentos: [{ id: 'm', lote_mudas_id: 'l1', tipo: 'entrada', quantidade: 5 }],
      reservas: [],
      fotos: [{ id: 'f1', especie_id: 'e1', parte: 'muda', arquivo: 'a.jpg', miniatura: 'a-mini.jpg', colecao: 'foto' }],
    });
    expect(itens[0].foto).toEqual({ id: 'f1', arquivo: 'a.jpg', miniatura: 'a-mini.jpg', parte: 'muda', colecao: 'foto' });
  });
});
