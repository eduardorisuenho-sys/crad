import { describe, expect, it } from 'vitest';
import { azulejos, enquadrar, linkGoogleMaps, mundo } from '../src/plataforma/mapa';

describe('mapa híbrido da rota de coleta', () => {
  it('converte coordenadas para pixels do mundo (Web Mercator)', () => {
    expect(mundo(0, 0, 0)).toEqual({ x: 128, y: 128 });
    const p = mundo(-10.18, -48.33, 10);
    expect(p.x).toBeCloseTo(((-48.33 + 180) / 360) * 256 * 1024, 3);
    expect(p.y).toBeGreaterThan(128 * 1024); // hemisfério sul fica abaixo do meio
  });

  it('escolhe o maior zoom que cabe todos os pontos e cobre a tela com azulejos', () => {
    const pontos = [{ lat: -10.18, lon: -48.33 }, { lat: -10.19, lon: -48.34 }];
    const v = enquadrar(pontos, 360, 300)!;
    for (const q of pontos) {
      const m = mundo(q.lat, q.lon, v.z);
      expect(m.x - v.ox).toBeGreaterThanOrEqual(0);
      expect(m.x - v.ox).toBeLessThanOrEqual(360);
      expect(m.y - v.oy).toBeGreaterThanOrEqual(0);
      expect(m.y - v.oy).toBeLessThanOrEqual(300);
    }
    expect(enquadrar(pontos, 360, 300, 28, v.z + 1)!.z).toBe(v.z); // não cabe com mais zoom
    expect(v.metrosPorPx).toBeGreaterThan(0);
    const az = azulejos(v);
    expect(az.length).toBeGreaterThanOrEqual(4);
    expect(az[0].urls[0]).toMatch(new RegExp(`/World_Imagery/MapServer/tile/${v.z}/\\d+/\\d+$`));
    expect(az[0].urls).toHaveLength(3);
  });

  it('um ponto só: zoom bem perto', () => {
    expect(enquadrar([{ lat: -10.18, lon: -48.33 }], 360, 300)!.z).toBe(18);
    expect(enquadrar([], 360, 300)).toBeNull();
  });

  it('link do Google Maps com o caminho até a matriz', () => {
    expect(linkGoogleMaps(-10.18, -48.33)).toBe('https://www.google.com/maps/dir/?api=1&destination=-10.18,-48.33&travelmode=driving');
  });
});
