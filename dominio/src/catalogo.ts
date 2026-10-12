/**
 * Catálogo público (Módulo 4): o que qualquer pessoa vê, sem login.
 * Só dados públicos: nada de coordenadas, proprietários, coletores ou contatos.
 */
import { reservaAtiva } from './doacao';
import { disponivel, saldoMudas } from './viveiro';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };

export interface DadosCatalogo {
  especies: Reg[];
  nomesPopulares: Reg[];
  viveiros: Reg[];
  lotesMudas: Reg[];
  movimentos: Reg[];
  reservas: Reg[];
  fotos: Reg[];
}

export interface ItemCatalogo {
  especie_id: string;
  nome_cientifico: string;
  familia: string;
  nomes_populares: string[];
  /** mudas prontas disponíveis (já sem as reservas), por viveiro */
  por_viveiro: { viveiro_id: string; viveiro: string; disponivel: number }[];
  total: number;
  foto?: { id: string; arquivo: string; miniatura: string; parte: string };
}

const ativos = (rs: Reg[]) => rs.filter((r) => !r.excluido);

function agrupar(rs: Reg[], campo: string): Map<string, Reg[]> {
  const m = new Map<string, Reg[]>();
  for (const r of rs) {
    const k = String(r[campo]);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}

/** Disponível de cada lote pronto = saldo − reservas ativas. */
export function disponivelPorLote(d: Pick<DadosCatalogo, 'lotesMudas' | 'movimentos' | 'reservas'>, hoje = new Date().toISOString()): Map<string, number> {
  const movs = agrupar(ativos(d.movimentos), 'lote_mudas_id');
  // Reserva vencida (prazo de retirada passou) não segura mais as mudas.
  const res = agrupar(
    d.reservas.filter((r) => reservaAtiva(r, hoje)),
    'lote_mudas_id',
  );
  const m = new Map<string, number>();
  for (const l of ativos(d.lotesMudas)) {
    if (l.fase_atual !== 'pronta' || l.situacao === 'encerrado') continue;
    m.set(l.id, disponivel(saldoMudas((movs.get(l.id) ?? []) as never), (res.get(l.id) ?? []) as never));
  }
  return m;
}

/**
 * Espécies com mudas prontas para doar que ainda não aparecem para quem pede
 * mudas (a espécie não está publicada no catálogo). Fictícias ficam de fora.
 */
export function prontasForaDoCatalogo(d: Pick<DadosCatalogo, 'lotesMudas' | 'movimentos' | 'reservas' | 'especies'>, hoje = new Date().toISOString()): { especie_id: string; mudas: number }[] {
  const disp = disponivelPorLote(d, hoje);
  const especies = new Map(ativos(d.especies).map((e) => [e.id, e]));
  const m = new Map<string, number>();
  for (const l of ativos(d.lotesMudas)) {
    const q = disp.get(l.id) ?? 0;
    const e = especies.get(String(l.especie_id));
    if (q <= 0 || !e || e.publicada || e.ficticia) continue;
    m.set(e.id, (m.get(e.id) ?? 0) + q);
  }
  return [...m].map(([especie_id, mudas]) => ({ especie_id, mudas })).sort((a, b) => b.mudas - a.mudas);
}

/** Espécies publicadas com mudas prontas disponíveis, somadas por viveiro. */
export function montarCatalogo(d: DadosCatalogo): ItemCatalogo[] {
  const disp = disponivelPorLote(d);
  const especies = new Map(ativos(d.especies).map((e) => [e.id, e]));
  const viveiros = new Map(ativos(d.viveiros).map((v) => [v.id, v]));
  const populares = agrupar(ativos(d.nomesPopulares), 'especie_id');
  const fotos = agrupar(
    ativos(d.fotos).filter((f) => f.arquivo),
    'especie_id',
  );
  const itens = new Map<string, ItemCatalogo>();
  for (const l of ativos(d.lotesMudas)) {
    const q = disp.get(l.id) ?? 0;
    if (q <= 0) continue;
    const e = especies.get(String(l.especie_id));
    if (!e || !e.publicada || e.ficticia) continue;
    let item = itens.get(e.id);
    if (!item) {
      const ordemFoto = ['muda', 'arvore', 'flor', 'fruto', 'folha'];
      const fs = [...(fotos.get(e.id) ?? [])].sort((a, b) => ordemFoto.indexOf(String(a.parte)) - ordemFoto.indexOf(String(b.parte)));
      item = {
        especie_id: e.id,
        nome_cientifico: String(e.nome_cientifico),
        familia: String(e.familia ?? ''),
        nomes_populares: (populares.get(e.id) ?? []).map((n) => String(n.nome)),
        por_viveiro: [],
        total: 0,
        foto: fs[0] ? { id: fs[0].id, arquivo: String(fs[0].arquivo), miniatura: String(fs[0].miniatura ?? ''), parte: String(fs[0].parte) } : undefined,
      };
      itens.set(e.id, item);
    }
    const vid = String(l.viveiro_id);
    let pv = item.por_viveiro.find((p) => p.viveiro_id === vid);
    if (!pv) {
      pv = { viveiro_id: vid, viveiro: String(viveiros.get(vid)?.nome ?? ''), disponivel: 0 };
      item.por_viveiro.push(pv);
    }
    pv.disponivel += q;
    item.total += q;
  }
  return [...itens.values()].sort((a, b) => (a.nomes_populares[0] ?? a.nome_cientifico).localeCompare(b.nomes_populares[0] ?? b.nome_cientifico, 'pt-BR'));
}

export interface RastreioPublico {
  lote_mudas: { codigo: string; viveiro: string; data_semeadura: string; fase: string; estoque_inicial?: boolean };
  lote_sementes?: { codigo: string; data_formacao: string; matrizes: number; municipios: string[] };
}

/**
 * Rastreio público do lote: de onde vieram as sementes. Mostra só o número de
 * matrizes e os municípios (nunca a coordenada, o proprietário ou o coletor).
 */
export function montarRastreio(
  lote: Reg,
  d: { viveiros: Reg[]; lotesSementes: Reg[]; ligacoes: Reg[]; coletas: Reg[]; matrizes: Reg[]; municipios: Reg[] },
): RastreioPublico {
  const viveiro = d.viveiros.find((v) => v.id === lote.viveiro_id);
  const r: RastreioPublico = {
    lote_mudas: { codigo: String(lote.codigo), viveiro: String(viveiro?.nome ?? ''), data_semeadura: String(lote.data_semeadura ?? ''), fase: String(lote.fase_atual ?? ''), ...(lote.origem === 'estoque_inicial' ? { estoque_inicial: true } : {}) },
  };
  const ls = d.lotesSementes.find((l) => l.id === lote.lote_sementes_id && !l.excluido);
  if (!ls) return r;
  const coletaIds = new Set(ativos(d.ligacoes).filter((l) => l.lote_sementes_id === ls.id).map((l) => String(l.coleta_id)));
  const matrizIds = new Set(ativos(d.coletas).filter((c) => coletaIds.has(c.id)).map((c) => String(c.matriz_id)));
  const nomesMun = new Map(d.municipios.map((m) => [m.id, String(m.nome)]));
  const municipios = new Set<string>();
  for (const m of d.matrizes) if (matrizIds.has(m.id) && m.municipio_id) municipios.add(nomesMun.get(String(m.municipio_id)) ?? '');
  municipios.delete('');
  r.lote_sementes = { codigo: String(ls.codigo), data_formacao: String(ls.data_formacao ?? ''), matrizes: matrizIds.size, municipios: [...municipios].sort() };
  return r;
}

/** Campos da ficha que podem ser públicos. */
export const CAMPOS_FICHA_PUBLICA = [
  'nome_cientifico',
  'autor',
  'familia',
  'origem',
  'forma_vida',
  'folha',
  'disposicao',
  'latex',
  'espinhos',
  'casca',
  'flor',
  'fruto',
  'meses_flor',
  'meses_fruto',
  'grupo_sucessional',
  'lorenzi_volume',
  'lorenzi_pagina',
] as const;

export function fichaPublica(e: Reg): Record<string, unknown> {
  const f: Record<string, unknown> = { id: e.id };
  for (const c of CAMPOS_FICHA_PUBLICA) if (e[c] !== undefined && e[c] !== null && e[c] !== '' && e[c] !== 0) f[c] = e[c];
  return f;
}
