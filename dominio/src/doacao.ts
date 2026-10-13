/** Regras do Módulo 5 (doação de mudas) e do Plantando Água. */

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };
const ativos = <T extends { excluido?: boolean }>(rs: T[]) => rs.filter((r) => !r.excluido);
const dia = (s: unknown) => String(s ?? '').slice(0, 10);

export const SITUACOES_EM_ANALISE = ['enviada', 'em_analise'];
export const SITUACOES_APROVADAS = ['aprovada', 'aprovada_parcial'];

/** Reserva que ainda segura mudas: ativa e dentro do prazo. */
export function reservaAtiva(r: { situacao?: unknown; valida_ate?: unknown; excluido?: boolean }, hoje: string): boolean {
  return !r.excluido && r.situacao === 'ativa' && (!r.valida_ate || dia(r.valida_ate) >= dia(hoje));
}

export interface ItemPedido {
  especie_id: string;
  quantidade: number;
}

/** Bloqueios do pedido: quantidade válida, dentro do disponível e do limite por espécie (o total não tem limite). */
export function bloqueiosPedido(itens: ItemPedido[], disponivelPorEspecie: Map<string, number>, limitePorEspecie: number, nomes?: Map<string, string>): string[] {
  const b: string[] = [];
  const validos = itens.filter((i) => i.quantidade > 0);
  if (!validos.length) b.push('Escolha pelo menos uma espécie.');
  for (const i of validos) {
    const nome = nomes?.get(i.especie_id) ?? i.especie_id;
    if (!Number.isInteger(i.quantidade)) b.push(`Quantidade de ${nome} deve ser um número inteiro.`);
    const disp = disponivelPorEspecie.get(i.especie_id) ?? 0;
    if (i.quantidade > disp) b.push(`Há ${disp} mudas de ${nome} disponíveis.`);
    if (i.quantidade > limitePorEspecie) b.push(`Cada pedido pode ter até ${limitePorEspecie} mudas de ${nome}.`);
  }
  return b;
}

export interface LoteDisponivel {
  id: string;
  especie_id: string;
  data_semeadura: string;
  disponivel: number;
}

export interface ReservaPlanejada {
  doacao_item_id: string;
  lote_mudas_id: string;
  quantidade: number;
}

/**
 * Reservas ao aprovar: para cada item, tira dos lotes prontos mais antigos
 * primeiro. Se não houver mudas suficientes, nada é reservado.
 */
export function planejarReservas(itens: { doacao_item_id: string; especie_id: string; quantidade: number }[], lotes: LoteDisponivel[]): { reservas: ReservaPlanejada[] } | { erro: string } {
  const restante = new Map(lotes.map((l) => [l.id, l.disponivel]));
  const ordenados = [...lotes].sort((a, b) => a.data_semeadura.localeCompare(b.data_semeadura) || a.id.localeCompare(b.id));
  const reservas: ReservaPlanejada[] = [];
  for (const item of itens) {
    let falta = item.quantidade;
    for (const l of ordenados) {
      if (falta <= 0) break;
      if (l.especie_id !== item.especie_id) continue;
      const q = Math.min(falta, restante.get(l.id) ?? 0);
      if (q <= 0) continue;
      reservas.push({ doacao_item_id: item.doacao_item_id, lote_mudas_id: l.id, quantidade: q });
      restante.set(l.id, (restante.get(l.id) ?? 0) - q);
      falta -= q;
    }
    if (falta > 0) return { erro: `Faltam ${falta} mudas prontas para atender o item ${item.doacao_item_id}.` };
  }
  return { reservas };
}

/** Situação da doação depois da análise. */
export function situacaoAposAnalise(itens: { qtd_pedida: number; qtd_aprovada: number }[]): 'aprovada' | 'aprovada_parcial' | 'negada' {
  const aprovado = itens.reduce((s, i) => s + i.qtd_aprovada, 0);
  if (!aprovado) return 'negada';
  return itens.every((i) => i.qtd_aprovada >= i.qtd_pedida) ? 'aprovada' : 'aprovada_parcial';
}

/** Quem pode aprovar: perfis definidos pelo gestor (parâmetro perfis_aprovadores). */
export function podeAprovar(perfis: string[], aprovadores: string[]): boolean {
  return perfis.some((p) => aprovadores.includes(p));
}

/** Data limite de retirada (aprovação + prazo em dias). */
export function prazoRetirada(aprovadoEm: string, dias: number): string {
  const d = new Date(`${dia(aprovadoEm)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function bloqueioRetirada(doacao: { situacao?: unknown; retirar_ate?: unknown }, hoje: string): string | null {
  if (!SITUACOES_APROVADAS.includes(String(doacao.situacao))) return 'Só pedidos aprovados podem ser retirados.';
  if (doacao.retirar_ate && dia(hoje) > dia(doacao.retirar_ate)) return 'O prazo de retirada venceu. O pedido precisa ser aprovado de novo.';
  return null;
}

export interface Consumo {
  reserva_id: string;
  doacao_item_id: string;
  lote_mudas_id: string;
  quantidade: number;
}

/**
 * Retirada: consome as reservas do pedido. Pode entregar menos que o
 * aprovado (o resto da reserva é liberado), nunca mais.
 */
export function planejarRetirada(reservas: Reg[], entregas: Record<string, number>): { consumos: Consumo[]; liberar: string[] } | { erro: string } {
  const porItem = new Map<string, Reg[]>();
  for (const r of ativos(reservas).filter((r) => r.situacao === 'ativa')) {
    const k = String(r.doacao_item_id);
    (porItem.get(k) ?? porItem.set(k, []).get(k)!).push(r);
  }
  const consumos: Consumo[] = [];
  const liberar: string[] = [];
  for (const [item, rs] of porItem) {
    const reservado = rs.reduce((s, r) => s + Number(r.quantidade), 0);
    let falta = Number(entregas[item] ?? 0);
    if (!Number.isInteger(falta) || falta < 0) return { erro: 'Quantidade entregue inválida.' };
    if (falta > reservado) return { erro: `Foram reservadas ${reservado} mudas para este item; não dá para entregar ${falta}.` };
    for (const r of rs) {
      const q = Math.min(falta, Number(r.quantidade));
      // Reserva usada (mesmo em parte) é encerrada como consumida: a sobra volta ao estoque.
      if (q > 0) consumos.push({ reserva_id: r.id, doacao_item_id: item, lote_mudas_id: String(r.lote_mudas_id), quantidade: q });
      else liberar.push(r.id);
      falta -= q;
    }
  }
  for (const item of Object.keys(entregas)) if (entregas[item] > 0 && !porItem.has(item)) return { erro: 'Item sem reserva.' };
  return { consumos, liberar };
}

// ---------------------------------------------------------------------------
// Plantando Água (e outros programas): marcação na doação, com histórico.

/** A doação está marcada no programa? Vale a última ação do histórico. */
export function marcadaNoPrograma(historico: Reg[], doacaoId: string, programaId: string): boolean {
  const h = ativos(historico)
    .filter((x) => x.doacao_id === doacaoId && x.programa_id === programaId)
    .sort((a, b) => String(a.criado_no_aparelho_em ?? a.created ?? '').localeCompare(String(b.criado_no_aparelho_em ?? b.created ?? '')));
  return h.length ? h[h.length - 1].acao === 'marcou' : false;
}

/** Desmarcar depois da retirada pede justificativa. */
export function bloqueioDesmarcar(doacao: { situacao?: unknown }, motivo: string): string | null {
  if (doacao.situacao === 'retirada' && !motivo.trim()) return 'A doação já foi retirada: diga o motivo para tirar do programa.';
  return null;
}

export interface Totais {
  pedidos: number;
  mudas_pedidas: number;
  mudas_aprovadas: number;
  mudas_entregues: number;
  por_especie: Record<string, number>;
}

/**
 * Totais das doações. Com `programaDoacoes`, conta só as doações do programa
 * (é um recorte: a doação continua contada uma vez só no total geral).
 */
export function totaisDoacoes(doacoes: Reg[], itens: Reg[], programaDoacoes?: Set<string>): Totais {
  const ids = new Set(
    ativos(doacoes)
      .filter((d) => !['rascunho', 'cancelada'].includes(String(d.situacao)))
      .filter((d) => !programaDoacoes || programaDoacoes.has(d.id))
      .map((d) => d.id),
  );
  const t: Totais = { pedidos: ids.size, mudas_pedidas: 0, mudas_aprovadas: 0, mudas_entregues: 0, por_especie: {} };
  for (const i of ativos(itens)) {
    if (!ids.has(String(i.doacao_id))) continue;
    t.mudas_pedidas += Number(i.qtd_pedida ?? 0);
    t.mudas_aprovadas += Number(i.qtd_aprovada ?? 0);
    t.mudas_entregues += Number(i.qtd_entregue ?? 0);
    const e = String(i.especie_id);
    t.por_especie[e] = (t.por_especie[e] ?? 0) + Number(i.qtd_entregue ?? 0);
  }
  return t;
}
