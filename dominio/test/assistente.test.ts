import { describe, expect, it } from 'vitest';
import { alertasDaEscolha, NAO_SEI, pontuar, proximaPergunta, type EspecieAssistente, type PerguntaAssistente } from '../src/assistente';
import { ESPECIES_FICTICIAS, PERGUNTAS_PADRAO } from '../src/exemplos';
import { distanciaMetros, pontoNoPoligono } from '../src/geo';

// Usa as perguntas padrão com as chaves como ids, e as espécies fictícias.
const perguntas: PerguntaAssistente[] = PERGUNTAS_PADRAO.map((p) => ({ id: p.chave, texto: p.texto, ordem: p.ordem, opcoes: p.opcoes.map((o) => ({ id: o.chave, rotulo: o.rotulo })) }));
const especies: EspecieAssistente[] = ESPECIES_FICTICIAS.map((e) => ({ id: e.chave, opcoes: new Set(e.opcoes), meses_flor: e.meses_flor, meses_fruto: e.meses_fruto, biomas: e.biomas }));
const ids = (c: { especie_id: string }[]) => c.map((x) => x.especie_id);

describe('assistente de identificação', () => {
  it('cada resposta estreita a lista', () => {
    expect(pontuar(especies, perguntas, {})).toHaveLength(5);
    const r1 = pontuar(especies, perguntas, { folha: 'folha_digitada' });
    expect(ids(r1).slice(0, 2).sort()).toEqual(['a', 'b']);
    const r2 = pontuar(especies, perguntas, { folha: 'folha_digitada', cor_flor: 'flor_amarela' });
    expect(ids(r2)).toEqual(['a', 'b']); // b com uma resposta contrária ainda aparece
    expect(r2[0]).toMatchObject({ especie_id: 'a', combina: 2, contraria: 0 });
  });

  it('tolera um engano, mas duas respostas contrárias tiram a espécie', () => {
    const r = pontuar(especies, perguntas, { folha: 'folha_digitada', cor_flor: 'flor_amarela', casca: 'casca_rugosa' });
    expect(ids(r)).not.toContain('b');
    expect(ids(r)[0]).toBe('a');
  });

  it('"não sei" não pesa', () => {
    expect(pontuar(especies, perguntas, { folha: NAO_SEI })).toEqual(pontuar(especies, perguntas, {}));
  });

  it('filtra pelo bioma do local e usa a época do que o coletor está vendo', () => {
    expect(ids(pontuar(especies, perguntas, {}, { biomas: ['caatinga'] }))).toEqual(['c']);
    const julho = pontuar(especies, perguntas, { folha: 'folha_digitada' }, { mes: 7, vendo: ['flor'] });
    expect(julho.find((c) => c.especie_id === 'a')!.pontos).toBe(4);
    const janeiro = pontuar(especies, perguntas, { folha: 'folha_digitada' }, { mes: 1, vendo: ['flor'] });
    expect(janeiro.find((c) => c.especie_id === 'a')!.alertas).toEqual(['flores fora da época conhecida']);
  });

  it('pergunta primeiro o que mais separa as candidatas e pula o que já foi respondido', () => {
    const todas = pontuar(especies, perguntas, {});
    const p1 = proximaPergunta(todas, especies, perguntas, {})!;
    expect(['fruto', 'cor_flor', 'folha', 'casca']).toContain(p1.id);
    const r = { folha: 'folha_digitada' };
    const p2 = proximaPergunta(pontuar(especies, perguntas, r), especies, perguntas, r)!;
    expect(p2.id).not.toBe('folha');
    // entre a e b, disposição e látex são iguais: não ajudam
    expect(['disposicao', 'latex', 'espinhos']).not.toContain(p2.id);
  });

  it('sem pergunta útil quando sobra uma espécie', () => {
    const r = { folha: 'folha_simples' };
    expect(proximaPergunta(pontuar(especies, perguntas, r).slice(0, 1), especies, perguntas, r)).toBeNull();
  });

  it('avisa quando a espécie escolhida não combina com o local ou a época', () => {
    const d = especies.find((e) => e.id === 'd')!;
    expect(alertasDaEscolha(d, { biomas: ['cerrado'], mes: 7, vendo: ['flor'] })).toEqual([
      'Não há registro desta espécie no bioma deste local.',
      'Esta espécie não costuma florir neste mês.',
    ]);
  });
});

describe('geo', () => {
  it('distância entre pontos', () => {
    // 0,001 grau de latitude ≈ 111 m
    expect(distanciaMetros({ lat: -10, lon: -48 }, { lat: -10.001, lon: -48 })).toBeCloseTo(111.2, 0);
  });
  it('ponto dentro de polígono', () => {
    const quadrado = { type: 'Polygon', coordinates: [[[-49, -11], [-47, -11], [-47, -9], [-49, -9], [-49, -11]]] };
    expect(pontoNoPoligono({ lat: -10, lon: -48 }, quadrado)).toBe(true);
    expect(pontoNoPoligono({ lat: -12, lon: -48 }, quadrado)).toBe(false);
  });
});
