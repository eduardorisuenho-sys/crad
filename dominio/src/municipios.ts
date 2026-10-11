/**
 * Municípios do IBGE: importação da malha (GeoJSON) e dos nomes, e o
 * município de um ponto de GPS (funciona sem internet, com os contornos
 * guardados no aparelho).
 */
import { pontoNoPoligono, type Ponto } from './geo';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };
type Geometria = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };

/** Endereços do IBGE (abertos no navegador de quem importa). */
export const urlMalhaIbge = (codigoUf: string) =>
  `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${codigoUf}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=intermediaria`;
export const urlNomesIbge = (codigoUf: string) => `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${codigoUf}/municipios`;
/** Código IBGE das UFs (os 2 primeiros dígitos do código do município). */
export const UF_CODIGO: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};
const UF_POR_CODIGO = Object.fromEntries(Object.entries(UF_CODIGO).map(([uf, c]) => [c, uf]));

export interface MunicipioLido {
  codigo_ibge: string;
  nome: string;
  uf: string;
  contorno: Geometria | null;
}

const texto = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

/**
 * Lê a malha do IBGE (API de malhas: propriedade `codarea`; arquivos do
 * IBGE convertidos: `CD_MUN`/`NM_MUN`) e, se houver, a lista de nomes da API
 * de localidades (`[{ id, nome }]`).
 */
export function lerMunicipiosIbge(malha: unknown, nomes?: unknown): { municipios: MunicipioLido[]; erros: string[] } {
  const erros: string[] = [];
  const fc = malha as { type?: string; features?: { properties?: Record<string, unknown>; geometry?: Geometria | null }[] } | null;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return { municipios: [], erros: ['O arquivo não é um GeoJSON de municípios (FeatureCollection).'] };
  const nomePorCodigo = new Map<string, string>();
  if (Array.isArray(nomes)) for (const n of nomes as Record<string, unknown>[]) if (n && texto(n.id) && texto(n.nome)) nomePorCodigo.set(texto(n.id), texto(n.nome));
  const vistos = new Set<string>();
  const municipios: MunicipioLido[] = [];
  for (const [i, f] of fc.features.entries()) {
    const p = f.properties ?? {};
    const codigo = texto(p.codarea ?? p.CD_MUN ?? p.cd_mun ?? p.CD_GEOCMU ?? p.codigo_ibge ?? p.id);
    if (!/^\d{7}$/.test(codigo)) {
      erros.push(`Item ${i + 1}: código do município ausente ou inválido.`);
      continue;
    }
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);
    const nome = nomePorCodigo.get(codigo) ?? texto(p.NM_MUN ?? p.nm_mun ?? p.NM_MUNICIP ?? p.nome ?? p.name);
    const uf = texto(p.SIGLA_UF ?? p.SIGLA ?? p.sigla_uf ?? p.uf) || UF_POR_CODIGO[codigo.slice(0, 2)] || '';
    const g = f.geometry;
    const contorno = g && (g.type === 'Polygon' || g.type === 'MultiPolygon') ? simplificar(g) : null;
    if (!contorno) erros.push(`${nome || codigo}: sem contorno.`);
    if (!nome) erros.push(`${codigo}: sem nome (envie também a lista de nomes do IBGE).`);
    municipios.push({ codigo_ibge: codigo, nome, uf, contorno });
  }
  return { municipios: municipios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), erros };
}

/** Tolerância da simplificação em graus (~50 m): o contorno fica leve para o celular. */
export const TOLERANCIA_CONTORNO = 0.0005;

/** Simplifica o contorno (Douglas-Peucker) e arredonda a 5 casas (~1 m). */
export function simplificar(g: Geometria, tol = TOLERANCIA_CONTORNO): Geometria {
  const anel = (pts: number[][]) => {
    const s = douglasPeucker(pts, tol).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
    return s.length >= 4 ? s : pts.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
  };
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: (g.coordinates as number[][][]).map(anel) };
  return { type: 'MultiPolygon', coordinates: (g.coordinates as number[][][][]).map((p) => p.map(anel)) };
}

function douglasPeucker(pts: number[][], tol: number): number[][] {
  if (pts.length <= 4) return pts;
  const manter = new Uint8Array(pts.length);
  manter[0] = manter[pts.length - 1] = 1;
  const pilha: [number, number][] = [[0, pts.length - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop()!;
    let maior = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distSegmento(pts[i], pts[a], pts[b]);
      if (d > maior) {
        maior = d;
        idx = i;
      }
    }
    if (idx >= 0 && maior > tol) {
      manter[idx] = 1;
      pilha.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => manter[i]);
}

function distSegmento(p: number[], a: number[], b: number[]): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2)) : 0;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export interface PlanoMunicipios {
  novos: MunicipioLido[];
  /** já existiam (pelo código IBGE): nome, UF ou contorno serão atualizados */
  atualizar: { id: string; dados: MunicipioLido }[];
  iguais: number;
}

export function planejarMunicipios(lidos: MunicipioLido[], existentes: Reg[]): PlanoMunicipios {
  const porCodigo = new Map(existentes.filter((e) => !e.excluido).map((e) => [String(e.codigo_ibge), e]));
  const plano: PlanoMunicipios = { novos: [], atualizar: [], iguais: 0 };
  for (const m of lidos) {
    const e = porCodigo.get(m.codigo_ibge);
    if (!e) plano.novos.push(m);
    else if (e.nome !== m.nome || e.uf !== m.uf || !mesmoContorno(e.contorno, m.contorno)) plano.atualizar.push({ id: e.id, dados: m });
    else plano.iguais++;
  }
  return plano;
}

/** Compara contornos pelo conteúdo (o servidor pode mudar a ordem das chaves do JSON). */
function mesmoContorno(a: unknown, b: Geometria | null): boolean {
  const g = a as Geometria | null | undefined;
  if (!g || !b) return !g && !b;
  return g.type === b.type && JSON.stringify(g.coordinates) === JSON.stringify(b.coordinates);
}

type Caixa = [number, number, number, number];
function caixa(g: Geometria): Caixa {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const pol = g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  for (const p of pol) for (const [x, y] of p[0] ?? []) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Prepara a busca do município de um ponto (calcula as caixas uma vez). */
export function indiceMunicipios<T extends Reg>(municipios: T[]) {
  const itens = municipios
    .filter((m) => !m.excluido && m.contorno && typeof m.contorno === 'object')
    .map((m) => ({ m, g: m.contorno as Geometria, c: caixa(m.contorno as Geometria) }));
  return {
    /** Município que contém o ponto, ou null (fora dos contornos importados). */
    doPonto(p: Ponto): T | null {
      for (const { m, g, c } of itens) {
        if (p.lon < c[0] || p.lon > c[2] || p.lat < c[1] || p.lat > c[3]) continue;
        if (pontoNoPoligono(p, g)) return m;
      }
      return null;
    },
  };
}

/** Acha o município pelo nome digitado (sem acento e sem diferença de maiúsculas). */
export function municipioPeloNome<T extends Reg>(nome: string, municipios: T[], uf?: string): T | null {
  const n = semAcento(nome);
  if (!n) return null;
  return municipios.find((m) => !m.excluido && semAcento(String(m.nome)) === n && (!uf || m.uf === uf)) ?? null;
}
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
