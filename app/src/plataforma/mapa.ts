/**
 * Mapa de fundo híbrido (satélite + nomes e estradas) em "azulejos" de
 * 256 px, como nos mapas da internet (projeção Web Mercator). Sem biblioteca:
 * calcula o zoom que cabe todos os pontos e quais azulejos desenhar.
 *
 * Imagens: Esri World Imagery (uso livre com o crédito na tela). Os azulejos
 * já vistos ficam guardados no aparelho e aparecem sem internet.
 */
export const CAMADAS_HIBRIDO = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
];
export const CREDITO_HIBRIDO = 'Imagens: Esri, Maxar, Earthstar Geographics';

const T = 256;

/** Posição em pixels no "mundo" do zoom z. */
export function mundo(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = T * 2 ** z;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

export interface Vista {
  z: number;
  /** canto superior esquerdo da tela, em pixels do mundo */
  ox: number;
  oy: number;
  largura: number;
  altura: number;
  /** metros por pixel no centro */
  metrosPorPx: number;
}

/** Maior zoom (até zMax) em que todos os pontos cabem na tela com margem. */
export function enquadrar(pontos: { lat: number; lon: number }[], largura: number, altura: number, margem = 28, zMax = 18): Vista | null {
  if (!pontos.length) return null;
  let z = zMax;
  for (; z > 1; z--) {
    const p = pontos.map((q) => mundo(q.lat, q.lon, z));
    const w = Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x));
    const h = Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y));
    if (w <= largura - 2 * margem && h <= altura - 2 * margem) break;
  }
  const p = pontos.map((q) => mundo(q.lat, q.lon, z));
  const cx = (Math.max(...p.map((q) => q.x)) + Math.min(...p.map((q) => q.x))) / 2;
  const cy = (Math.max(...p.map((q) => q.y)) + Math.min(...p.map((q) => q.y))) / 2;
  const latMedia = pontos.reduce((s, q) => s + q.lat, 0) / pontos.length;
  return { z, ox: cx - largura / 2, oy: cy - altura / 2, largura, altura, metrosPorPx: (156543.03392 * Math.cos((latMedia * Math.PI) / 180)) / 2 ** z };
}

/** Azulejos que cobrem a tela: posição na tela e endereço de cada camada. */
export function azulejos(v: Vista, camadas = CAMADAS_HIBRIDO): { chave: string; x: number; y: number; urls: string[] }[] {
  const n = 2 ** v.z;
  const out: { chave: string; x: number; y: number; urls: string[] }[] = [];
  for (let ty = Math.floor(v.oy / T); ty <= Math.floor((v.oy + v.altura) / T); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(v.ox / T); tx <= Math.floor((v.ox + v.largura) / T); tx++) {
      const xx = ((tx % n) + n) % n;
      out.push({ chave: `${v.z}/${tx}/${ty}`, x: tx * T - v.ox, y: ty * T - v.oy, urls: camadas.map((c) => c.replace('{z}', String(v.z)).replace('{x}', String(xx)).replace('{y}', String(ty))) });
    }
  }
  return out;
}

/** Link para abrir o ponto no Google Maps (vista de satélite) e traçar o caminho até ele. */
export function linkGoogleMaps(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

const DIRECOES = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];

/** Rumo de `de` até `para`, em graus (0 = norte, 90 = leste), e o nome da direção. */
export function rumo(de: { lat: number; lon: number }, para: { lat: number; lon: number }): { graus: number; direcao: string } {
  const r = Math.PI / 180;
  const dl = (para.lon - de.lon) * r;
  const y = Math.sin(dl) * Math.cos(para.lat * r);
  const x = Math.cos(de.lat * r) * Math.sin(para.lat * r) - Math.sin(de.lat * r) * Math.cos(para.lat * r) * Math.cos(dl);
  const graus = (Math.atan2(y, x) / r + 360) % 360;
  return { graus, direcao: DIRECOES[Math.round(graus / 45) % 8] };
}
