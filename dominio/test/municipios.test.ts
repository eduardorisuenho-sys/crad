import { describe, expect, it } from 'vitest';
import { indiceMunicipios, lerMunicipiosIbge, municipioPeloNome, planejarMunicipios, simplificar } from '../src/municipios';

// Dois "municípios" fictícios (quadrados), com códigos de teste.
const quadrado = (x: number, y: number, l: number) => [[[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]]];
const malha = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { codarea: '1799901' }, geometry: { type: 'Polygon', coordinates: quadrado(-48.5, -10.5, 0.5) } },
    { type: 'Feature', properties: { codarea: '1799902' }, geometry: { type: 'Polygon', coordinates: quadrado(-48.0, -10.5, 0.5) } },
    { type: 'Feature', properties: { codarea: 'x' }, geometry: null },
  ],
};
const nomes = [
  { id: 1799901, nome: 'Município Teste Oeste' },
  { id: 1799902, nome: 'Município Teste Leste' },
];

describe('municípios do IBGE', () => {
  it('lê a malha da API do IBGE com os nomes da API de localidades', () => {
    const { municipios, erros } = lerMunicipiosIbge(malha, nomes);
    expect(municipios.map((m) => [m.codigo_ibge, m.nome, m.uf])).toEqual([
      ['1799902', 'Município Teste Leste', 'TO'],
      ['1799901', 'Município Teste Oeste', 'TO'],
    ]);
    expect(erros).toEqual(['Item 3: código do município ausente ou inválido.']);
  });

  it('lê arquivos do IBGE convertidos (CD_MUN, NM_MUN, SIGLA_UF)', () => {
    const { municipios } = lerMunicipiosIbge({ type: 'FeatureCollection', features: [{ properties: { CD_MUN: '1799903', NM_MUN: 'Teste Norte', SIGLA_UF: 'TO' }, geometry: { type: 'MultiPolygon', coordinates: [quadrado(0, 0, 1)] } }] });
    expect(municipios[0]).toMatchObject({ codigo_ibge: '1799903', nome: 'Teste Norte', uf: 'TO' });
  });

  it('recusa arquivo que não é GeoJSON', () => {
    expect(lerMunicipiosIbge({ a: 1 }).erros[0]).toMatch(/não é um GeoJSON/);
  });

  it('acha o município do ponto de GPS', () => {
    const { municipios } = lerMunicipiosIbge(malha, nomes);
    const regs = municipios.map((m, i) => ({ id: `m${i}`, ...m }));
    const idx = indiceMunicipios(regs);
    expect(idx.doPonto({ lat: -10.2, lon: -48.3 })?.nome).toBe('Município Teste Oeste');
    expect(idx.doPonto({ lat: -10.2, lon: -47.8 })?.nome).toBe('Município Teste Leste');
    expect(idx.doPonto({ lat: -5, lon: -48.3 })).toBeNull();
  });

  it('simplifica contornos com muitos pontos sem perder a forma', () => {
    const pts: number[][] = [];
    for (let i = 0; i <= 1000; i++) pts.push([i / 1000, 0.00001 * Math.sin(i)]); // linha quase reta
    pts.push([1, 1], [0, 1], [0, 0.00001 * Math.sin(0)]);
    const s = simplificar({ type: 'Polygon', coordinates: [pts] });
    expect((s.coordinates as number[][][])[0].length).toBeLessThan(10);
  });

  it('planeja a importação: novos, atualizados e iguais', () => {
    const { municipios } = lerMunicipiosIbge(malha, nomes);
    const [leste, oeste] = municipios;
    const plano = planejarMunicipios(municipios, [
      { id: 'a', ...oeste },
      { id: 'b', ...leste, nome: 'Nome antigo' },
    ]);
    expect(plano.novos).toHaveLength(0);
    expect(plano.atualizar.map((a) => a.id)).toEqual(['b']);
    expect(plano.iguais).toBe(1);
  });

  it('acha pelo nome sem acento', () => {
    const regs = [{ id: 'x', nome: 'Município Teste Leste', uf: 'TO' }];
    expect(municipioPeloNome('municipio teste LESTE', regs)?.id).toBe('x');
    expect(municipioPeloNome('outro', regs)).toBeNull();
  });
});

describe('contorno vindo do servidor', () => {
  it('não acusa mudança só porque as chaves do JSON vieram em outra ordem', () => {
    const { municipios } = lerMunicipiosIbge(malha, nomes);
    const doServidor = municipios.map((m, i) => ({ id: `s${i}`, ...m, contorno: { coordinates: m.contorno!.coordinates, type: m.contorno!.type } }));
    expect(planejarMunicipios(municipios, doServidor).iguais).toBe(2);
  });
});
