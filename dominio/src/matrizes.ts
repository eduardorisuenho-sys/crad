/** Regras do Módulo 1 (matrizes): diversidade genética, metas e validação. */
import { distanciaMetros, coordenadaValida } from './geo';
import { PARAMETROS_PADRAO } from './esquema';

export interface MatrizResumo {
  id: string;
  codigo?: string;
  especie_id?: string | null;
  lat?: number | null;
  lon?: number | null;
  situacao?: string;
  situacao_validacao?: string;
  grau_certeza?: string;
  excluido?: boolean;
}

/** Lê um parâmetro do gestor (do viveiro, senão o geral, senão o padrão). */
export function parametro<T>(parametros: { chave?: unknown; valor?: unknown; viveiro_id?: unknown; excluido?: unknown }[], chave: string, viveiroId?: string): T {
  const ativos = parametros.filter((p) => p.chave === chave && !p.excluido);
  const doViveiro = viveiroId ? ativos.find((p) => p.viveiro_id === viveiroId) : undefined;
  const geral = ativos.find((p) => !p.viveiro_id);
  const p = doViveiro ?? geral;
  return (p && p.valor !== undefined && p.valor !== null ? p.valor : PARAMETROS_PADRAO[chave]?.valor) as T;
}

const conta = (m: MatrizResumo) => !m.excluido && m.situacao !== 'morta' && m.situacao !== 'inativa' && m.situacao_validacao !== 'reprovada';

export interface MatrizProxima {
  id: string;
  codigo?: string;
  distancia_m: number;
}

/**
 * Matrizes da mesma espécie perto demais (podem ser parentes e reduzir a
 * diversidade genética das sementes).
 */
export function matrizesProximas(nova: MatrizResumo, todas: MatrizResumo[], distanciaMinima: number): MatrizProxima[] {
  if (!nova.especie_id || !coordenadaValida(nova.lat, nova.lon)) return [];
  const p = { lat: nova.lat as number, lon: nova.lon as number };
  return todas
    .filter((m) => m.id !== nova.id && m.especie_id === nova.especie_id && conta(m) && coordenadaValida(m.lat, m.lon))
    .map((m) => ({ id: m.id, codigo: m.codigo, distancia_m: Math.round(distanciaMetros(p, { lat: m.lat as number, lon: m.lon as number })) }))
    .filter((m) => m.distancia_m < distanciaMinima)
    .sort((a, b) => a.distancia_m - b.distancia_m);
}

export interface MetaEspecie {
  especie_id: string;
  matrizes: number;
  aprovadas: number;
  meta: number;
  faltam: number;
}

/** Quantas matrizes cada espécie tem, contra a meta (ex.: 12 por espécie). */
export function metasPorEspecie(matrizes: MatrizResumo[], meta: number, especies?: string[]): MetaEspecie[] {
  const porEspecie = new Map<string, MetaEspecie>();
  for (const id of especies ?? []) porEspecie.set(id, { especie_id: id, matrizes: 0, aprovadas: 0, meta, faltam: meta });
  for (const m of matrizes) {
    if (!m.especie_id || !conta(m)) continue;
    const e = porEspecie.get(m.especie_id) ?? { especie_id: m.especie_id, matrizes: 0, aprovadas: 0, meta, faltam: meta };
    e.matrizes++;
    if (m.situacao_validacao === 'aprovada') e.aprovadas++;
    e.faltam = Math.max(0, meta - e.matrizes);
    porEspecie.set(m.especie_id, e);
  }
  return [...porEspecie.values()].sort((a, b) => b.faltam - a.faltam || a.especie_id.localeCompare(b.especie_id));
}

/** O gestor só aprova matriz com espécie definida e identificação confirmada. */
export function bloqueioAprovacao(m: MatrizResumo): string | null {
  if (!m.especie_id) return 'Defina a espécie antes de aprovar.';
  if (m.grau_certeza !== 'certo') return 'Confirme a identificação (grau "certo") antes de aprovar.';
  if (!coordenadaValida(m.lat, m.lon)) return 'A matriz não tem um ponto de GPS válido.';
  return null;
}

/** Matriz pode fornecer sementes para lote (Módulo 2)? */
export function podeColetar(m: MatrizResumo): boolean {
  return conta(m) && m.situacao_validacao === 'aprovada';
}

/** Fotos obrigatórias que ainda faltam. */
export function fotosFaltando(partesTiradas: string[], obrigatorias: string[]): string[] {
  return obrigatorias.filter((p) => !partesTiradas.includes(p));
}
