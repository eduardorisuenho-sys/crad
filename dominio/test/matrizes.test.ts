import { describe, expect, it } from 'vitest';
import { bloqueioAprovacao, fotosFaltando, matrizesProximas, metasPorEspecie, parametro, podeColetar } from '../src/matrizes';

const base = { lat: -10.18, lon: -48.33 };
// 0,0005 grau de latitude ≈ 55 m
const m = (id: string, especie: string, dLat: number, extra = {}) => ({ id, codigo: id.toUpperCase(), especie_id: especie, lat: base.lat + dLat, lon: base.lon, ...extra });

describe('diversidade genética', () => {
  it('avisa matriz da mesma espécie a menos da distância mínima', () => {
    const todas = [m('a', 'ipe', 0.0005), m('b', 'ipe', 0.002), m('c', 'baru', 0.0001), m('d', 'ipe', 0.0003, { situacao: 'morta' })];
    const r = matrizesProximas({ id: 'nova', especie_id: 'ipe', ...base }, todas, 100);
    expect(r).toEqual([{ id: 'a', codigo: 'A', distancia_m: 56 }]);
  });

  it('sem espécie ou sem GPS não há como comparar', () => {
    expect(matrizesProximas({ id: 'x', especie_id: null, ...base }, [m('a', 'ipe', 0)], 100)).toEqual([]);
    expect(matrizesProximas({ id: 'x', especie_id: 'ipe', lat: null, lon: null }, [m('a', 'ipe', 0)], 100)).toEqual([]);
  });

  it('conta matrizes por espécie contra a meta e mostra as que faltam primeiro', () => {
    const todas = [m('a', 'ipe', 0, { situacao_validacao: 'aprovada' }), m('b', 'ipe', 0), m('c', 'baru', 0), m('d', 'baru', 0, { situacao_validacao: 'reprovada' })];
    expect(metasPorEspecie(todas, 12, ['angico'])).toEqual([
      { especie_id: 'angico', matrizes: 0, aprovadas: 0, meta: 12, faltam: 12 },
      { especie_id: 'baru', matrizes: 1, aprovadas: 0, meta: 12, faltam: 11 },
      { especie_id: 'ipe', matrizes: 2, aprovadas: 1, meta: 12, faltam: 10 },
    ]);
  });
});

describe('validação', () => {
  it('só aprova com espécie confirmada e GPS', () => {
    expect(bloqueioAprovacao({ id: 'a', especie_id: null })).toMatch(/espécie/);
    expect(bloqueioAprovacao({ id: 'a', especie_id: 'ipe', grau_certeza: 'provavel', ...base })).toMatch(/Confirme/);
    expect(bloqueioAprovacao({ id: 'a', especie_id: 'ipe', grau_certeza: 'certo', lat: 0, lon: 0 })).toMatch(/GPS/);
    expect(bloqueioAprovacao({ id: 'a', especie_id: 'ipe', grau_certeza: 'certo', ...base })).toBeNull();
  });

  it('só matriz aprovada e viva fornece sementes', () => {
    expect(podeColetar({ id: 'a', situacao_validacao: 'aprovada' })).toBe(true);
    expect(podeColetar({ id: 'a', situacao_validacao: 'pendente' })).toBe(true); // não precisa de aprovação
    expect(podeColetar({ id: 'a' })).toBe(true);
    expect(podeColetar({ id: 'a', situacao_validacao: 'aprovada', situacao: 'morta' })).toBe(false);
  });

  it('fotos obrigatórias', () => {
    expect(fotosFaltando(['folha'], ['arvore', 'folha'])).toEqual(['arvore']);
  });
});

describe('parâmetros', () => {
  it('usa o do viveiro, senão o geral, senão o padrão', () => {
    const ps = [
      { chave: 'distancia_min_matrizes_m', valor: 150 },
      { chave: 'distancia_min_matrizes_m', valor: 80, viveiro_id: 'gur' },
    ];
    expect(parametro<number>(ps, 'distancia_min_matrizes_m', 'gur')).toBe(80);
    expect(parametro<number>(ps, 'distancia_min_matrizes_m', 'pal')).toBe(150);
    expect(parametro<number>([], 'distancia_min_matrizes_m')).toBe(100);
    expect(parametro<number>([], 'meta_matrizes_por_especie')).toBe(12);
  });
});
