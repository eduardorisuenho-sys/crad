/** Cálculos de mapa: distância entre pontos e ponto dentro de polígono. */

export interface Ponto {
  lat: number;
  lon: number;
}

/** Distância em metros (fórmula de Haversine). */
export function distanciaMetros(a: Ponto, b: Ponto): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ponto dentro de um Polygon/MultiPolygon GeoJSON (coordenadas [lon, lat]). */
export function pontoNoPoligono(p: Ponto, geometria: { type: string; coordinates: unknown }): boolean {
  const aneis = (poli: number[][][]) => {
    let dentro = false;
    poli.forEach((anel, i) => {
      if (dentroDoAnel(p, anel)) dentro = i === 0 ? true : false;
    });
    return dentro;
  };
  if (geometria.type === 'Polygon') return aneis(geometria.coordinates as number[][][]);
  if (geometria.type === 'MultiPolygon') return (geometria.coordinates as number[][][][]).some(aneis);
  return false;
}

function dentroDoAnel(p: Ponto, anel: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Coordenada válida e dentro do Brasil (com folga). */
export function coordenadaValida(lat: unknown, lon: unknown): boolean {
  return typeof lat === 'number' && typeof lon === 'number' && lat > -35 && lat < 6 && lon > -75 && lon < -28;
}
