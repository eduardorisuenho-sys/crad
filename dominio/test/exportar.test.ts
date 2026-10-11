import { describe, expect, it } from 'vitest';
import { escreverCsv, escreverKml, escreverXlsx } from '../src/planilha/exportar';
import { lerXlsx } from '../src/planilha/xlsx';

describe('exportação', () => {
  it('planilha Excel: ida e volta pelo leitor', () => {
    const bytes = escreverXlsx([
      { nome: 'Matrizes', linhas: [['Código', 'Espécie', 'Altura (m)'], ['MT-0001', 'Ipê & <cia>', 14.5], ['MT-0002', null, 3]] },
      { nome: 'Doações: total/ano', linhas: [['Ano', 'Mudas'], ['2026', 40]] },
    ]);
    const abas = lerXlsx(bytes);
    expect(abas.map((a) => a.nome)).toEqual(['Matrizes', 'Doações  total ano']);
    expect(abas[0].linhas).toEqual([['Código', 'Espécie', 'Altura (m)'], ['MT-0001', 'Ipê & <cia>', 14.5], ['MT-0002', undefined, 3]]);
  });
  it('CSV com ; , vírgula decimal e aspas', () => {
    expect(escreverCsv([['a', 'b;c'], [1.5, 'diz "oi"']])).toBe('﻿a;"b;c"\r\n1,5;"diz ""oi"""');
  });
  it('KML com camadas e dados', () => {
    const k = escreverKml('CRAD', [{ nome: 'Plantios', cor: '#48672f', pontos: [{ nome: 'DO-2026-001', lat: -10.18, lon: -48.33, descricao: { mudas: 40, especie: 'Ipê' } }] }]);
    expect(k).toContain('<coordinates>-48.33,-10.18,0</coordinates>');
    expect(k).toContain('<color>ff2f6748</color>');
    expect(k).toContain('<Data name="mudas"><value>40</value></Data>');
  });
});
