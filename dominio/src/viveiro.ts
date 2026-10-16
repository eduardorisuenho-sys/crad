/** Regras do Módulo 3 (viveiro): germinação, fases, estoque de mudas e inventário. */
import { FASES_MUDA } from './esquema';

export type Fase = (typeof FASES_MUDA)[number];

/** Taxa de germinação real: plântulas emergidas ÷ sementes semeadas (em %). */
export function taxaGerminacao(semeadas: number | null | undefined, germinadas: number | null | undefined): number | null {
  if (!semeadas || semeadas <= 0 || germinadas === null || germinadas === undefined) return null;
  return Math.round((germinadas / semeadas) * 1000) / 10;
}

export interface MovimentoMudas {
  tipo: string;
  quantidade: number;
  excluido?: boolean;
  /** o servidor recusou: não vale no saldo até ser corrigido */
  _rejeitado?: boolean;
}

/**
 * Saldo de mudas do lote. Entradas somam; perdas, saídas por doação e
 * transferências tiram; o ajuste de inventário vem com o sinal.
 */
export function saldoMudas(movs: MovimentoMudas[]): number {
  let s = 0;
  for (const m of movs) {
    if (m.excluido || m._rejeitado) continue;
    const q = Number(m.quantidade ?? 0);
    if (m.tipo === 'entrada') s += Math.abs(q);
    else if (m.tipo === 'ajuste_inventario') s += q;
    else s -= Math.abs(q);
  }
  return s;
}

/** Disponível para doação = saldo − reservas ativas (Módulo 5). */
export function disponivel(saldo: number, reservasAtivas: { quantidade: number }[]): number {
  return Math.max(0, saldo - reservasAtivas.reduce((s, r) => s + Number(r.quantidade ?? 0), 0));
}

/**
 * Nova contagem de germinação (acumulada). Devolve quantas mudas entram no
 * estoque (a diferença para a contagem anterior) ou o motivo do bloqueio.
 */
export function entradaPorContagem(semeadas: number | null | undefined, anterior: number, nova: number): { entrada: number } | { erro: string } {
  if (!Number.isInteger(nova) || nova < 0) return { erro: 'Informe um número inteiro de plântulas.' };
  if (semeadas && nova > semeadas) return { erro: `Foram semeadas ${semeadas} sementes: a contagem não pode passar disso.` };
  if (nova < anterior) return { erro: `A contagem anterior foi ${anterior}. Para mudas que morreram, use "Perda".` };
  return { entrada: nova - anterior };
}

/** Fases só andam para frente (pode pular fase). */
export function proximasFases(atual: string | null | undefined): Fase[] {
  const i = FASES_MUDA.indexOf((atual ?? 'semeadura') as Fase);
  return FASES_MUDA.slice(i + 1) as Fase[];
}

export function bloqueioMudancaFase(atual: string | null | undefined, nova: string): string | null {
  if (!(FASES_MUDA as readonly string[]).includes(nova)) return 'Fase desconhecida.';
  if (!proximasFases(atual).includes(nova as Fase)) return 'A fase só pode avançar.';
  return null;
}

/** Perda ou saída não pode passar do saldo. */
export function bloqueioSaidaMudas(saldo: number, quantidade: number): string | null {
  if (!Number.isInteger(quantidade) || quantidade <= 0) return 'Informe um número inteiro de mudas.';
  if (quantidade > saldo) return `O lote tem ${saldo} mudas.`;
  return null;
}

/** Data em que o lote deve ficar pronto (semeadura + tempo médio da espécie). */
export function dataPrevistaPronta(dataSemeadura: string | null | undefined, mesesAtePronta: number | null | undefined): string | null {
  if (!dataSemeadura || !mesesAtePronta) return null;
  const d = new Date(`${dataSemeadura.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + Math.round(mesesAtePronta));
  return d.toISOString().slice(0, 10);
}

/** Lote atrasado: passou da data prevista e ainda não está pronto. */
export function atrasado(previsao: string | null, fase: string | null | undefined, hoje: string): boolean {
  return !!previsao && fase !== 'pronta' && hoje.slice(0, 10) > previsao;
}

export interface ItemInventario {
  lote_mudas_id: string;
  saldo_sistema: number;
  contado: number | null;
}

/** Diferenças do inventário: viram ajustes no estoque ao fechar. */
export function ajustesInventario(itens: ItemInventario[]): { lote_mudas_id: string; diferenca: number }[] {
  return itens.filter((i) => i.contado !== null && i.contado !== i.saldo_sistema).map((i) => ({ lote_mudas_id: i.lote_mudas_id, diferenca: (i.contado as number) - i.saldo_sistema }));
}
