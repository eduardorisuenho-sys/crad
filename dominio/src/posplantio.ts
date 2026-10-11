/** Regras do Módulo 6 (pós-plantio): plantio, sobrevivência e conferência de fotos. */
import { coordenadaValida, distanciaMetros, type Ponto } from './geo';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };
const ativos = <T extends { excluido?: boolean }>(rs: T[]) => rs.filter((r) => !r.excluido);

/** Plantado não pode passar do entregue em cada espécie. */
export function bloqueiosPlantio(entregues: Map<string, number>, plantadas: Map<string, number>, nomes?: Map<string, string>): string[] {
  const b: string[] = [];
  let total = 0;
  for (const [especie, q] of plantadas) {
    if (!Number.isInteger(q) || q < 0) b.push('Informe números inteiros.');
    const ent = entregues.get(especie) ?? 0;
    if (q > ent) b.push(`Foram entregues ${ent} mudas de ${nomes?.get(especie) ?? especie}.`);
    total += q;
  }
  if (!total) b.push('Informe quantas mudas foram plantadas.');
  return [...new Set(b)];
}

/** Vivas não pode passar do plantado. */
export function bloqueiosMonitoramento(plantadas: Map<string, number>, vivas: Map<string, number>, nomes?: Map<string, string>): string[] {
  const b: string[] = [];
  for (const [especie, v] of vivas) {
    if (!Number.isInteger(v) || v < 0) b.push('Informe números inteiros.');
    const p = plantadas.get(especie) ?? 0;
    if (v > p) b.push(`Foram plantadas ${p} mudas de ${nomes?.get(especie) ?? especie}.`);
  }
  return [...new Set(b)];
}

export function taxaSobrevivencia(plantadas: number, vivas: number): number | null {
  if (!plantadas) return null;
  return Math.round((vivas / plantadas) * 1000) / 10;
}

export interface Sobrevivencia {
  /** monitoramento usado (o mais recente; no mesmo dia, a vistoria vale mais que o relato) */
  monitoramento_id: string | null;
  data: string | null;
  tipo: string | null;
  plantadas: number;
  vivas: number;
  taxa: number | null;
  por_especie: { especie_id: string; plantadas: number; vivas: number; taxa: number | null }[];
}

/** Sobrevivência do plantio pelo acompanhamento mais recente. */
export function sobrevivenciaDoPlantio(plantioItens: Reg[], monitoramentos: Reg[], monitoramentoItens: Reg[]): Sobrevivencia {
  const plantadasPor = new Map<string, number>();
  for (const i of ativos(plantioItens)) plantadasPor.set(String(i.especie_id), (plantadasPor.get(String(i.especie_id)) ?? 0) + Number(i.quantidade ?? 0));
  const plantadas = [...plantadasPor.values()].reduce((s, q) => s + q, 0);
  const ultimo = ativos(monitoramentos).sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.tipo === 'vistoria') - Number(a.tipo === 'vistoria'))[0];
  if (!ultimo) {
    return { monitoramento_id: null, data: null, tipo: null, plantadas, vivas: plantadas, taxa: null, por_especie: [...plantadasPor].map(([especie_id, p]) => ({ especie_id, plantadas: p, vivas: p, taxa: null })) };
  }
  const vivasPor = new Map<string, number>();
  for (const i of ativos(monitoramentoItens).filter((i) => i.monitoramento_id === ultimo.id)) vivasPor.set(String(i.especie_id), Number(i.vivas ?? 0));
  const por_especie = [...plantadasPor].map(([especie_id, p]) => {
    const v = vivasPor.get(especie_id) ?? 0;
    return { especie_id, plantadas: p, vivas: v, taxa: taxaSobrevivencia(p, v) };
  });
  const vivas = por_especie.reduce((s, e) => s + e.vivas, 0);
  return { monitoramento_id: ultimo.id, data: String(ultimo.data), tipo: String(ultimo.tipo), plantadas, vivas, taxa: taxaSobrevivencia(plantadas, vivas), por_especie };
}

/** Ponto do plantio guardado como GeoJSON Point. */
export function pontoDoPlantio(geometria: unknown): Ponto | null {
  const g = geometria as { type?: string; coordinates?: number[] } | null;
  if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const [lon, lat] = g.coordinates;
  return coordenadaValida(lat, lon) ? { lat, lon } : null;
}

/**
 * Foto que precisa de conferência: sem GPS, ou tirada longe do local do
 * plantio (mais que `distanciaMaxima` metros).
 */
export function conferirFoto(foto: { lat?: unknown; lon?: unknown }, local: Ponto | null, distanciaMaxima: number): string | null {
  if (!coordenadaValida(foto.lat, foto.lon)) return 'foto sem GPS';
  if (!local) return null;
  const d = distanciaMetros(local, { lat: foto.lat as number, lon: foto.lon as number });
  return d > distanciaMaxima ? `foto a ${Math.round(d)} m do local informado` : null;
}
