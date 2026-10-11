import { describe, expect, it } from 'vitest';
import { bloqueiosMonitoramento, bloqueiosPlantio, conferirFoto, pontoDoPlantio, sobrevivenciaDoPlantio, taxaSobrevivencia } from '../src/posplantio';

describe('plantio', () => {
  it('não planta mais que o entregue', () => {
    const ent = new Map([['ipe', 20]]);
    expect(bloqueiosPlantio(ent, new Map([['ipe', 20]]))).toEqual([]);
    expect(bloqueiosPlantio(ent, new Map([['ipe', 25]]), new Map([['ipe', 'Ipê']]))).toEqual(['Foram entregues 20 mudas de Ipê.']);
    expect(bloqueiosPlantio(ent, new Map([['ipe', 0]]))).toEqual(['Informe quantas mudas foram plantadas.']);
  });
  it('vivas não passam das plantadas', () => {
    expect(bloqueiosMonitoramento(new Map([['ipe', 20]]), new Map([['ipe', 21]]))).toEqual(['Foram plantadas 20 mudas de ipe.']);
    expect(bloqueiosMonitoramento(new Map([['ipe', 20]]), new Map([['ipe', 18]]))).toEqual([]);
  });
});

describe('sobrevivência', () => {
  const itens = [
    { id: 'a', especie_id: 'ipe', quantidade: 20 },
    { id: 'b', especie_id: 'baru', quantidade: 10 },
  ];
  it('taxa = vivas ÷ plantadas', () => {
    expect(taxaSobrevivencia(30, 24)).toBe(80);
    expect(taxaSobrevivencia(0, 0)).toBeNull();
  });
  it('vale o acompanhamento mais recente; no mesmo dia, a vistoria', () => {
    const mons = [
      { id: 'm1', data: '2026-03-01', tipo: 'relato' },
      { id: 'm2', data: '2026-09-01', tipo: 'relato' },
      { id: 'm3', data: '2026-09-01', tipo: 'vistoria' },
    ];
    const mi = [
      { id: 'x', monitoramento_id: 'm1', especie_id: 'ipe', vivas: 20 },
      { id: 'y', monitoramento_id: 'm2', especie_id: 'ipe', vivas: 19 },
      { id: 'z', monitoramento_id: 'm3', especie_id: 'ipe', vivas: 15 },
      { id: 'w', monitoramento_id: 'm3', especie_id: 'baru', vivas: 9 },
    ];
    expect(sobrevivenciaDoPlantio(itens, mons, mi)).toEqual({
      monitoramento_id: 'm3',
      data: '2026-09-01',
      tipo: 'vistoria',
      plantadas: 30,
      vivas: 24,
      taxa: 80,
      por_especie: [
        { especie_id: 'ipe', plantadas: 20, vivas: 15, taxa: 75 },
        { especie_id: 'baru', plantadas: 10, vivas: 9, taxa: 90 },
      ],
    });
  });
  it('sem acompanhamento ainda não há taxa', () => {
    expect(sobrevivenciaDoPlantio(itens, [], []).taxa).toBeNull();
  });
});

describe('conferência das fotos', () => {
  const local = pontoDoPlantio({ type: 'Point', coordinates: [-48.33, -10.18] });
  it('lê o ponto do plantio', () => {
    expect(local).toEqual({ lat: -10.18, lon: -48.33 });
    expect(pontoDoPlantio(null)).toBeNull();
  });
  it('marca foto sem GPS ou longe do local', () => {
    expect(conferirFoto({ lat: -10.1801, lon: -48.33 }, local, 500)).toBeNull();
    expect(conferirFoto({ lat: -10.2, lon: -48.33 }, local, 500)).toMatch(/foto a 2224 m/);
    expect(conferirFoto({}, local, 500)).toBe('foto sem GPS');
  });
});
