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
  /** colecao = 'foto' quando é foto das mudas de um lote (servida por outra rota) */
  foto?: { id: string; arquivo: string; miniatura: string; parte: string; colecao?: string; data?: string };
}

/** Quando a foto foi tirada: a data registrada no aparelho ou, em fotos antigas, a do cadastro. */
export function dataDaFoto(f: Record<string, unknown>): string {
  for (const k of ['tirada_em', 'criado_no_aparelho_em', 'created']) if (typeof f[k] === 'string' && f[k]) return String(f[k]);
  return '';
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
 * Espécies com mudas prontas disponíveis, somadas por viveiro. Toda espécie
 * com muda pronta aparece (não precisa publicar nem liberar).
 */
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
    if (!e) continue;
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
        foto: fs[0] ? { id: fs[0].id, arquivo: String(fs[0].arquivo), miniatura: String(fs[0].miniatura ?? ''), parte: String(fs[0].parte), ...(fs[0].colecao ? { colecao: String(fs[0].colecao) } : {}), ...(dataDaFoto(fs[0]) ? { data: dataDaFoto(fs[0]) } : {}) } : undefined,
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
  lote_sementes?: { codigo: string; data_formacao: string; matrizes: number; municipios: string[]; arvores_sem_matriz?: number; estoque_inicial?: boolean };
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
  const doLote = ativos(d.coletas).filter((c) => coletaIds.has(c.id));
  const matrizIds = new Set(doLote.filter((c) => c.matriz_id).map((c) => String(c.matriz_id)));
  const semMatriz = doLote.filter((c) => !c.matriz_id).length;
  const nomesMun = new Map(d.municipios.map((m) => [m.id, String(m.nome)]));
  const municipios = new Set<string>();
  for (const m of d.matrizes) if (matrizIds.has(m.id) && m.municipio_id) municipios.add(nomesMun.get(String(m.municipio_id)) ?? '');
  municipios.delete('');
  r.lote_sementes = {
    codigo: String(ls.codigo),
    data_formacao: String(ls.data_formacao ?? ''),
    matrizes: matrizIds.size,
    municipios: [...municipios].sort(),
    ...(semMatriz ? { arvores_sem_matriz: semMatriz } : {}),
    ...(ls.origem === 'estoque_inicial' ? { estoque_inicial: true } : {}),
  };
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

/**
 * Versão das regras do catálogo no servidor. 2 = toda espécie verdadeira com
 * muda pronta aparece (não precisa publicar); 3 = todas, sem exceção.
 * O app compara para avisar que o servidor está desatualizado.
 */
export const REGRAS_CATALOGO = 3;

export type MotivoForaDoCatalogo =
  | 'recusado'
  | 'nao_enviado'
  | 'em_formacao'
  | 'reservadas'
  | 'servidor_desatualizado'
  | 'sem_entrada_no_servidor'
  | 'especie_apagada'
  | 'esgotado_no_servidor'
  | 'nao_esta_no_servidor'
  | 'outra_especie'
  | 'servidor';

export interface LoteForaDoCatalogo {
  lote_id: string;
  codigo: string;
  especie_id: string;
  saldo: number;
  motivo: MotivoForaDoCatalogo;
}

/**
 * Por que as mudas deste aparelho não aparecem no catálogo do servidor:
 * olha cada lote com mudas e diz o motivo (para a equipe resolver sozinha).
 * `noCatalogo` = espécies que vieram no catálogo do servidor; `noServidor` =
 * a situação de cada lote fora do catálogo, como o servidor vê (pelo código).
 */
export function diagnosticoCatalogo(
  d: Pick<DadosCatalogo, 'lotesMudas' | 'movimentos' | 'reservas' | 'especies'>,
  noCatalogo: Set<string>,
  regrasServidor: number | undefined,
  noServidor: Map<string, string | { situacao: string; especie_id?: string }> = new Map(),
  hoje = new Date().toISOString(),
): LoteForaDoCatalogo[] {
  const movs = agrupar(ativos(d.movimentos), 'lote_mudas_id');
  const disp = disponivelPorLote(d, hoje);
  const fora: LoteForaDoCatalogo[] = [];
  for (const l of ativos(d.lotesMudas)) {
    if (l.situacao === 'encerrado') continue;
    const doLote = movs.get(l.id) ?? [];
    // conta também o que o servidor recusou, para avisar (no saldo de verdade não entra)
    const saldo = saldoMudas(doLote.map((m) => ({ ...m, _rejeitado: false })) as never);
    if (saldo <= 0) continue;
    const especie_id = String(l.especie_id);
    if (noCatalogo.has(especie_id)) continue;
    const noSrv = noServidor.get(String(l.codigo ?? ''));
    const situacao = typeof noSrv === 'string' ? noSrv : noSrv?.situacao;
    // o servidor manda todos os lotes (versão nova): dá para saber se ele tem este
    const servidorListaTodos = [...noServidor.values()].some((v) => typeof v === 'object');
    let motivo: MotivoForaDoCatalogo;
    if (l._rejeitado || doLote.some((m) => m._rejeitado)) motivo = 'recusado';
    else if (l.fase_atual !== 'pronta') motivo = 'em_formacao';
    else if ((disp.get(l.id) ?? 0) <= 0) motivo = 'reservadas';
    else if (l.versao === 0 || doLote.some((m) => m.versao === 0)) motivo = 'nao_enviado';
    else if ((regrasServidor ?? 1) < REGRAS_CATALOGO) motivo = 'servidor_desatualizado';
    else if (situacao === 'sem_entrada') motivo = 'sem_entrada_no_servidor';
    else if (situacao === 'sem_especie') motivo = 'especie_apagada';
    else if (situacao === 'esgotado') motivo = 'esgotado_no_servidor';
    else if (servidorListaTodos && !noSrv) motivo = 'nao_esta_no_servidor';
    else if (typeof noSrv === 'object' && noSrv.especie_id && noSrv.especie_id !== especie_id) motivo = 'outra_especie';
    else motivo = 'servidor';
    fora.push({ lote_id: l.id, codigo: String(l.codigo ?? ''), especie_id, saldo, motivo });
  }
  return fora;
}

export type SituacaoNoServidor = 'no_catalogo' | 'em_formacao' | 'reservadas' | 'sem_entrada' | 'esgotado' | 'sem_especie';

export interface ResumoCatalogo {
  lotes: number;
  no_catalogo: number;
  em_formacao: number;
  reservadas: number;
  /** nenhuma entrada de mudas chegou ao servidor */
  sem_entrada: number;
  /** teve mudas, mas todas já saíram (doação, perda) */
  esgotado: number;
  /** a espécie do lote foi apagada */
  sem_especie: number;
  /** situação de cada lote fora do catálogo, pelo código (público, como no rastreio) */
  fora: { codigo: string; situacao: SituacaoNoServidor }[];
  /** todos os lotes do servidor (código, situação e espécie): o aparelho confere os dele */
  lotes_servidor: { codigo: string; situacao: SituacaoNoServidor; especie_id: string }[];
}

export function resumoCatalogo(d: Pick<DadosCatalogo, 'lotesMudas' | 'movimentos' | 'reservas' | 'especies'>, hoje = new Date().toISOString()): ResumoCatalogo {
  const movs = agrupar(ativos(d.movimentos), 'lote_mudas_id');
  const disp = disponivelPorLote(d, hoje);
  const especies = new Map(ativos(d.especies).map((e) => [e.id, e]));
  const r: ResumoCatalogo = { lotes: 0, no_catalogo: 0, em_formacao: 0, reservadas: 0, sem_entrada: 0, esgotado: 0, sem_especie: 0, fora: [], lotes_servidor: [] };
  for (const l of ativos(d.lotesMudas)) {
    if (l.situacao === 'encerrado') continue;
    r.lotes++;
    const doLote = movs.get(l.id) ?? [];
    let s: SituacaoNoServidor;
    if (!especies.has(String(l.especie_id))) s = 'sem_especie';
    else if (!doLote.length) s = 'sem_entrada';
    else if (saldoMudas(doLote as never) <= 0) s = 'esgotado';
    else if (l.fase_atual !== 'pronta') s = 'em_formacao';
    else if ((disp.get(l.id) ?? 0) <= 0) s = 'reservadas';
    else s = 'no_catalogo';
    r[s]++;
    if (s !== 'no_catalogo') r.fora.push({ codigo: String(l.codigo ?? ''), situacao: s });
    r.lotes_servidor.push({ codigo: String(l.codigo ?? ''), situacao: s, especie_id: String(l.especie_id ?? '') });
  }
  return r;
}
