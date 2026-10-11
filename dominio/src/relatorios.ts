/**
 * Módulo 7: indicadores, rastreio completo e dados do portal público.
 * Tudo é calculado a partir dos registros (nada é digitado de novo).
 */
import { saldoSementes, emGramas } from './sementes';
import { saldoMudas, taxaGerminacao } from './viveiro';
import { marcadaNoPrograma, totaisDoacoes } from './doacao';
import { sobrevivenciaDoPlantio, pontoDoPlantio, taxaSobrevivencia } from './posplantio';
import { podeColetar, type MatrizResumo } from './matrizes';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };
const ativos = <T extends { excluido?: boolean }>(rs: T[]) => rs.filter((r) => !r.excluido);

export interface DadosRelatorio {
  viveiros: Reg[];
  especies: Reg[];
  nomesPopulares: Reg[];
  matrizes: Reg[];
  coletas: Reg[];
  lotesSementes: Reg[];
  ligacoes: Reg[];
  movSementes: Reg[];
  lotesMudas: Reg[];
  eventosMudas: Reg[];
  movMudas: Reg[];
  doacoes: Reg[];
  doacaoItens: Reg[];
  doacaoItemLotes: Reg[];
  historicoProgramas: Reg[];
  plantios: Reg[];
  plantioItens: Reg[];
  monitoramentos: Reg[];
  monitoramentoItens: Reg[];
}

export interface FiltroRelatorio {
  /** AAAA-MM-DD (inclusive) */
  inicio?: string;
  fim?: string;
  /** null/undefined = todos os viveiros somados */
  viveiros?: string[] | null;
  /** só as doações (e plantios) marcadas neste programa */
  programaId?: string;
}

const dia = (v: unknown) => String(v ?? '').slice(0, 10);
const noPeriodo = (data: unknown, f: FiltroRelatorio) => {
  const d = dia(data);
  if (!d) return !f.inicio && !f.fim;
  return (!f.inicio || d >= f.inicio) && (!f.fim || d <= f.fim);
};
const doViveiro = (r: Reg, f: FiltroRelatorio) => !f.viveiros || f.viveiros.includes(String(r.viveiro_id));

/** Data de referência de cada registro (quando aconteceu em campo). */
const dataDe = (r: Reg, campo?: string) => (campo ? r[campo] : undefined) ?? r.criado_no_aparelho_em ?? r.created;

export interface Indicadores {
  matrizes: { total: number; aprovadas: number; aguardando: number; especies: number };
  coletas: { total: number; kg: number; matrizes: number };
  sementes: { lotes: number; estoque_g: number };
  mudas: { lotes: number; semeadas: number; germinadas: number; taxa_germinacao: number | null; perdas: number; por_fase: Record<string, number>; prontas: number };
  doacoes: { pedidos: number; em_analise: number; mudas_pedidas: number; mudas_entregues: number; programa: number };
  plantio: { plantios: number; plantadas: number; vivas: number; sobrevivencia: number | null };
}

/** Doações marcadas num programa (vale a última ação do histórico). */
export function doacoesDoPrograma(historico: Reg[], programaId: string): Set<string> {
  const ids = new Set(ativos(historico).filter((h) => h.programa_id === programaId).map((h) => String(h.doacao_id)));
  return new Set([...ids].filter((d) => marcadaNoPrograma(historico as never, d, programaId)));
}

export function indicadores(d: DadosRelatorio, f: FiltroRelatorio = {}, programaPainel = 'plantandoagua01'): Indicadores {
  const matrizes = ativos(d.matrizes).filter((m) => doViveiro(m, f) && noPeriodo(dataDe(m), f));
  const coletas = ativos(d.coletas).filter((c) => doViveiro(c, f) && noPeriodo(dataDe(c, 'data'), f));
  const lotesS = ativos(d.lotesSementes).filter((l) => doViveiro(l, f));
  const lotesM = ativos(d.lotesMudas).filter((l) => doViveiro(l, f));
  const semeadosNoPeriodo = lotesM.filter((l) => noPeriodo(dataDe(l, 'data_semeadura'), f));
  const idsSemeados = new Set(semeadosNoPeriodo.map((l) => l.id));

  // Estoque é a foto de agora (não depende do período).
  const movS = ativos(d.movSementes);
  const estoque_g = lotesS.reduce((s, l) => s + saldoSementes(movS.filter((m) => m.lote_sementes_id === l.id) as never).g, 0);
  const movM = ativos(d.movMudas);
  const por_fase: Record<string, number> = {};
  for (const l of lotesM.filter((l) => l.situacao !== 'encerrado')) {
    const fase = String(l.fase_atual ?? 'semeadura');
    por_fase[fase] = (por_fase[fase] ?? 0) + saldoMudas(movM.filter((m) => m.lote_mudas_id === l.id) as never);
  }

  const germinadasPorLote = new Map<string, number>();
  for (const e of ativos(d.eventosMudas)) {
    if (e.tipo !== 'contagem_germinacao' || !idsSemeados.has(String(e.lote_mudas_id))) continue;
    germinadasPorLote.set(String(e.lote_mudas_id), Math.max(germinadasPorLote.get(String(e.lote_mudas_id)) ?? 0, Number(e.quantidade ?? 0)));
  }
  const semeadas = semeadosNoPeriodo.reduce((s, l) => s + Number(l.sementes_semeadas ?? 0), 0);
  const germinadas = [...germinadasPorLote.values()].reduce((s, q) => s + q, 0);
  const perdas = movM.filter((m) => m.tipo === 'perda' && lotesM.some((l) => l.id === m.lote_mudas_id) && noPeriodo(m.data, f)).reduce((s, m) => s + Number(m.quantidade ?? 0), 0);

  const programa = f.programaId ? doacoesDoPrograma(d.historicoProgramas, f.programaId) : undefined;
  const doacoes = ativos(d.doacoes).filter((x) => doViveiro(x, f) && noPeriodo(dataDe(x), f) && (!programa || programa.has(x.id)));
  const t = totaisDoacoes(doacoes, d.doacaoItens);
  const noPainelPrograma = doacoesDoPrograma(d.historicoProgramas, programaPainel);

  const idsDoacoes = new Set(doacoes.map((x) => x.id));
  const plantios = ativos(d.plantios).filter((p) => doViveiro(p, f) && noPeriodo(dataDe(p, 'data'), f) && (!programa || programa.has(String(p.doacao_id))));
  // Sobrevivência: só os plantios que já têm acompanhamento entram na taxa.
  let plantadasComAcomp = 0;
  let vivas = 0;
  for (const p of plantios) {
    const s = sobrevivenciaDoPlantio(
      d.plantioItens.filter((i) => i.plantio_id === p.id),
      d.monitoramentos.filter((m) => m.plantio_id === p.id),
      d.monitoramentoItens,
    );
    if (s.taxa === null) continue;
    plantadasComAcomp += s.plantadas;
    vivas += s.vivas;
  }
  const plantadasTotal = ativos(d.plantioItens).filter((i) => plantios.some((p) => p.id === i.plantio_id)).reduce((s, i) => s + Number(i.quantidade ?? 0), 0);

  return {
    matrizes: {
      total: matrizes.length,
      aprovadas: matrizes.filter((m) => podeColetar(m as MatrizResumo)).length,
      aguardando: matrizes.filter((m) => !m.situacao_validacao || m.situacao_validacao === 'pendente').length,
      especies: new Set(matrizes.map((m) => m.especie_id).filter(Boolean)).size,
    },
    coletas: {
      total: coletas.length,
      kg: Math.round(coletas.reduce((s, c) => s + (emGramas(c.quantidade as number, c.unidade as string) ?? 0), 0) / 10) / 100,
      matrizes: new Set(coletas.map((c) => c.matriz_id)).size,
    },
    sementes: { lotes: lotesS.length, estoque_g: Math.round(estoque_g * 100) / 100 },
    mudas: { lotes: lotesM.length, semeadas, germinadas, taxa_germinacao: taxaGerminacao(semeadas, germinadas), perdas, por_fase, prontas: por_fase.pronta ?? 0 },
    doacoes: {
      pedidos: t.pedidos,
      em_analise: doacoes.filter((x) => ['enviada', 'em_analise'].includes(String(x.situacao))).length,
      mudas_pedidas: t.mudas_pedidas,
      mudas_entregues: t.mudas_entregues,
      programa: [...idsDoacoes].filter((id) => noPainelPrograma.has(id)).length,
    },
    plantio: { plantios: plantios.length, plantadas: plantadasTotal, vivas, sobrevivencia: taxaSobrevivencia(plantadasComAcomp, vivas) },
  };
}

// ---------------------------------------------------------------------------
// rastreio completo (interno): de qualquer código, para trás e para frente

export interface Cadeia {
  matrizes: Reg[];
  coletas: Reg[];
  lotesSementes: Reg[];
  lotesMudas: Reg[];
  doacoes: Reg[];
  plantios: Reg[];
}

export function rastrearCadeia(codigo: string, d: DadosRelatorio): Cadeia | null {
  const c = codigo.trim().toUpperCase();
  const por = (rs: Reg[]) => ativos(rs).find((r) => String(r.codigo ?? '').toUpperCase() === c);
  const ms = new Set<string>();
  const cs = new Set<string>();
  const ls = new Set<string>();
  const lm = new Set<string>();
  const ds = new Set<string>();
  const inicio = por(d.matrizes) ?? por(d.lotesSementes) ?? por(d.lotesMudas) ?? por(d.doacoes);
  if (!inicio) return null;
  const itemParaDoacao = new Map(ativos(d.doacaoItens).map((i) => [i.id, String(i.doacao_id)]));

  // nível de partida: 0 matriz, 1 lote de sementes, 2 lote de mudas, 3 doação
  const nivel = ativos(d.matrizes).includes(inicio) ? 0 : ativos(d.lotesSementes).includes(inicio) ? 1 : ativos(d.lotesMudas).includes(inicio) ? 2 : 3;
  [ms, ls, lm, ds][nivel].add(inicio.id);

  // para trás: doação → lotes de mudas → lote de sementes → coletas → matrizes
  if (nivel >= 3) for (const il of ativos(d.doacaoItemLotes)) if (ds.has(itemParaDoacao.get(String(il.doacao_item_id)) ?? '')) lm.add(String(il.lote_mudas_id));
  if (nivel >= 2) for (const l of ativos(d.lotesMudas)) if (lm.has(l.id) && l.lote_sementes_id) ls.add(String(l.lote_sementes_id));
  if (nivel >= 1) {
    for (const g of ativos(d.ligacoes)) if (ls.has(String(g.lote_sementes_id))) cs.add(String(g.coleta_id));
    for (const co of ativos(d.coletas)) if (cs.has(co.id)) ms.add(String(co.matriz_id));
  }

  // para frente, só a partir do código pedido: matrizes → coletas → lotes de sementes → lotes de mudas → doações
  if (nivel <= 0) {
    for (const co of ativos(d.coletas)) if (ms.has(String(co.matriz_id))) cs.add(co.id);
    for (const g of ativos(d.ligacoes)) if (cs.has(String(g.coleta_id))) ls.add(String(g.lote_sementes_id));
  }
  if (nivel <= 1) for (const l of ativos(d.lotesMudas)) if (ls.has(String(l.lote_sementes_id))) lm.add(l.id);
  if (nivel <= 2) for (const il of ativos(d.doacaoItemLotes)) if (lm.has(String(il.lote_mudas_id))) ds.add(itemParaDoacao.get(String(il.doacao_item_id)) ?? '');
  ds.delete('');

  const pick = (rs: Reg[], ids: Set<string>) => ativos(rs).filter((r) => ids.has(r.id));
  return {
    matrizes: pick(d.matrizes, ms),
    coletas: pick(d.coletas, cs),
    lotesSementes: pick(d.lotesSementes, ls),
    lotesMudas: pick(d.lotesMudas, lm),
    doacoes: pick(d.doacoes, ds),
    plantios: ativos(d.plantios).filter((p) => ds.has(String(p.doacao_id))),
  };
}

// ---------------------------------------------------------------------------
// portal público (transparência): totais e mapa sem dados pessoais

export interface Transparencia {
  mudas_doadas: number;
  mudas_plantadas: number;
  sobrevivencia: number | null;
  doacoes: number;
  plantando_agua: { doacoes: number; mudas_doadas: number };
  especies_mais_distribuidas: { especie: string; mudas: number }[];
  /** pontos arredondados (~1 km) para não identificar propriedades */
  plantios: { lat: number; lon: number; mudas: number; ano: string }[];
  por_ano: { ano: string; mudas_doadas: number }[];
}

/** Arredonda a coordenada (2 casas ≈ 1,1 km). */
const generalizar = (v: number) => Math.round(v * 100) / 100;

export function montarTransparencia(d: DadosRelatorio, programaId = 'plantandoagua01'): Transparencia {
  const retiradas = ativos(d.doacoes).filter((x) => x.situacao === 'retirada');
  const ids = new Set(retiradas.map((x) => x.id));
  const itens = ativos(d.doacaoItens).filter((i) => ids.has(String(i.doacao_id)));
  const ficticias = new Set(ativos(d.especies).filter((e) => e.ficticia).map((e) => e.id));
  const nomes = new Map<string, string>(ativos(d.especies).map((e) => [e.id, String(e.nome_cientifico)]));
  const vistos = new Set<string>();
  for (const n of ativos(d.nomesPopulares)) if (!vistos.has(String(n.especie_id))) {
    vistos.add(String(n.especie_id));
    nomes.set(String(n.especie_id), String(n.nome));
  }
  const porEspecie = new Map<string, number>();
  for (const i of itens) if (!ficticias.has(String(i.especie_id))) porEspecie.set(String(i.especie_id), (porEspecie.get(String(i.especie_id)) ?? 0) + Number(i.qtd_entregue ?? 0));
  const programa = doacoesDoPrograma(d.historicoProgramas, programaId);
  const ano = (r: Reg) => dia(r.data ?? r.criado_no_aparelho_em ?? r.created).slice(0, 4) || 'sem data';
  const porAno = new Map<string, number>();
  for (const x of retiradas) {
    const q = itens.filter((i) => i.doacao_id === x.id).reduce((s, i) => s + Number(i.qtd_entregue ?? 0), 0);
    porAno.set(ano(x), (porAno.get(ano(x)) ?? 0) + q);
  }

  let plantadasComAcomp = 0;
  let vivas = 0;
  const pontos: Transparencia['plantios'] = [];
  for (const p of ativos(d.plantios)) {
    const s = sobrevivenciaDoPlantio(
      d.plantioItens.filter((i) => i.plantio_id === p.id),
      d.monitoramentos.filter((m) => m.plantio_id === p.id),
      d.monitoramentoItens,
    );
    if (s.taxa !== null) {
      plantadasComAcomp += s.plantadas;
      vivas += s.vivas;
    }
    const pt = pontoDoPlantio(p.geometria);
    if (pt) pontos.push({ lat: generalizar(pt.lat), lon: generalizar(pt.lon), mudas: s.plantadas, ano: ano(p) });
  }
  const mudasDoadas = itens.reduce((s, i) => s + Number(i.qtd_entregue ?? 0), 0);
  return {
    mudas_doadas: mudasDoadas,
    mudas_plantadas: ativos(d.plantioItens).reduce((s, i) => s + Number(i.quantidade ?? 0), 0),
    sobrevivencia: taxaSobrevivencia(plantadasComAcomp, vivas),
    doacoes: retiradas.length,
    plantando_agua: {
      doacoes: retiradas.filter((x) => programa.has(x.id)).length,
      mudas_doadas: itens.filter((i) => programa.has(String(i.doacao_id))).reduce((s, i) => s + Number(i.qtd_entregue ?? 0), 0),
    },
    especies_mais_distribuidas: [...porEspecie]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([e, mudas]) => ({ especie: nomes.get(e) ?? '', mudas })),
    plantios: pontos,
    por_ano: [...porAno].sort((a, b) => a[0].localeCompare(b[0])).map(([a, m]) => ({ ano: a, mudas_doadas: m })),
  };
}
