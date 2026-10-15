/** Regras do Módulo 2 (coleta e lotes de sementes). */
import { podeColetar, type MatrizResumo } from './matrizes';
import { normalizarBusca } from './especies/nomes';

export interface ColetaResumo {
  id: string;
  /** vazio = árvore sem matriz cadastrada */
  matriz_id?: string | null;
  especie_id?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  excluido?: boolean;
}

export interface VerificacaoLote {
  /** impedem a criação do lote */
  bloqueios: string[];
  /** avisos: o lote pode ser criado mesmo assim */
  alertas: string[];
  matrizes: number;
}

/**
 * Confere a formação de um lote de sementes:
 * - só uma espécie; só matrizes ativas (não precisam de aprovação); cada coleta em um lote só;
 * - alerta de diversidade genética com poucas matrizes.
 */
export function verificarLote(
  especieId: string | undefined,
  coletas: ColetaResumo[],
  matrizes: Map<string, MatrizResumo>,
  coletasEmLote: Set<string>,
  minMatrizes: number,
): VerificacaoLote {
  const bloqueios: string[] = [];
  const alertas: string[] = [];
  if (!especieId) bloqueios.push('Escolha a espécie do lote.');
  if (!coletas.length) bloqueios.push('Escolha pelo menos uma coleta.');
  const ids = new Set<string>();
  let semMatriz = 0;
  for (const c of coletas) {
    if (!c.matriz_id) {
      // Árvore sem matriz cadastrada: vale a espécie informada na coleta.
      semMatriz++;
      if (c.especie_id !== especieId) bloqueios.push('Uma das coletas sem matriz é de outra espécie: um lote tem uma espécie só.');
      if (coletasEmLote.has(c.id)) bloqueios.push('Uma das coletas sem matriz já está em outro lote.');
      continue;
    }
    const m = matrizes.get(c.matriz_id);
    const nome = m?.codigo ?? c.matriz_id;
    if (!m) bloqueios.push(`A matriz ${nome} não está no aparelho.`);
    else {
      if (m.especie_id !== especieId) bloqueios.push(`A matriz ${nome} é de outra espécie: um lote tem uma espécie só.`);
      if (!podeColetar(m)) bloqueios.push(`A matriz ${nome} está morta, inativa ou foi excluída.`);
    }
    if (coletasEmLote.has(c.id)) bloqueios.push(`A coleta da matriz ${nome} já está em outro lote.`);
    ids.add(c.matriz_id);
  }
  if (semMatriz) alertas.push(`${semMatriz} coleta(s) de árvore sem matriz cadastrada: a origem fica registrada só pela espécie.`);
  if (coletas.length && ids.size < minMatrizes) {
    alertas.push(`Este lote tem sementes de ${ids.size} matriz(es) cadastrada(s). O recomendado é pelo menos ${minMatrizes}, para manter a diversidade genética.`);
  }
  return { bloqueios: [...new Set(bloqueios)], alertas, matrizes: ids.size };
}

export interface MovimentoSementes {
  tipo: string;
  quantidade_g?: number | null;
  quantidade_unid?: number | null;
  excluido?: boolean;
}

/** Entradas somam; semeadura, teste e descarte tiram; ajuste vem com o sinal; mudança de endereço não mexe no saldo. */
const SINAL: Record<string, number> = { entrada: 1, semeadura: -1, teste: -1, descarte: -1, ajuste: 1, mudanca_endereco: 0 };

/**
 * Saldo do lote. O número de sementes só é controlado se o lote foi
 * cadastrado com uma contagem; sem contagem, fica 0 (nunca negativo).
 */
export function saldoSementes(movimentos: MovimentoSementes[]): { g: number; unid: number } {
  let g = 0;
  let unid = 0;
  let contado = false;
  for (const m of movimentos) {
    if (m.excluido) continue;
    const s = SINAL[m.tipo] ?? 0;
    const qg = Number(m.quantidade_g ?? 0);
    const qu = Number(m.quantidade_unid ?? 0);
    // No ajuste o sinal vem na quantidade; nos demais, a quantidade é sempre positiva.
    g += m.tipo === 'ajuste' ? qg : s * Math.abs(qg);
    unid += m.tipo === 'ajuste' ? qu : s * Math.abs(qu);
    if (s > 0 && qu > 0) contado = true;
  }
  return { g: Math.max(0, Math.round(g * 100) / 100), unid: contado ? Math.max(0, Math.round(unid)) : 0 };
}

/** A saída não pode deixar o saldo negativo. */
export function bloqueioSaida(saldo: { g: number; unid: number }, saida: { g?: number | null; unid?: number | null }): string | null {
  if ((saida.g ?? 0) > saldo.g + 1e-9) return `Só há ${saldo.g} g neste lote.`;
  // Só confere o número de sementes quando o lote tem contagem (saldo > 0).
  if (saldo.unid > 0 && (saida.unid ?? 0) > saldo.unid) return `Só há ${saldo.unid} sementes neste lote.`;
  return null;
}

/** Endereço legível do armazenamento, como numa farmácia: PAL-CAMARA1-E2-P3-CX4. */
export function codigoEndereco(sigla: string, partes: { local?: string; estante?: string; prateleira?: string; caixa?: string }): string {
  const limpar = (s?: string) => normalizarBusca(s ?? '').replace(/ /g, '').toUpperCase();
  const seg = [limpar(sigla), limpar(partes.local), partes.estante && `E${limpar(partes.estante)}`, partes.prateleira && `P${limpar(partes.prateleira)}`, partes.caixa && `CX${limpar(partes.caixa)}`];
  return seg.filter(Boolean).join('-');
}

/** Situação da validade: vencido, vence em breve (dias) ou ok. */
export function situacaoValidade(validade: string | null | undefined, hoje: string, avisoDias: number): 'vencido' | 'vence_logo' | 'ok' | 'sem_validade' {
  if (!validade) return 'sem_validade';
  const dias = (Date.parse(validade.slice(0, 10)) - Date.parse(hoje.slice(0, 10))) / 86_400_000;
  if (dias < 0) return 'vencido';
  if (dias <= avisoDias) return 'vence_logo';
  return 'ok';
}

/** Total coletado em gramas (quando a unidade permite converter). */
export function emGramas(quantidade: number | null | undefined, unidade: string | null | undefined): number | null {
  if (quantidade === null || quantidade === undefined) return null;
  if (unidade === 'g') return quantidade;
  if (unidade === 'kg') return quantidade * 1000;
  return null;
}

/**
 * Lote automático: cada coleta vira um lote de sementes sozinha (no servidor,
 * quando a coleta chega). A ligação coleta → lote mantém a rastreabilidade até
 * a matriz. Com sementes pesadas (g/kg), o peso entra no saldo; com frutos
 * (ou litros), o peso das sementes limpas é lançado depois, como ajuste.
 */
export function loteDaColeta(coleta: { data?: unknown; material?: unknown; quantidade?: unknown; unidade?: unknown; observacao?: unknown }): {
  data_formacao: string;
  peso_g: number | null;
  entrada_g: number;
  observacao: string;
} {
  const g = coleta.material === 'semente' ? emGramas(coleta.quantidade as number, coleta.unidade as string) : null;
  const qtd = coleta.quantidade ? `${String(coleta.quantidade).replace('.', ',')} ${String(coleta.unidade ?? '')}`.trim() : '';
  return {
    data_formacao: String(coleta.data ?? '').slice(0, 10),
    peso_g: g,
    entrada_g: g ?? 0,
    observacao: g !== null ? 'lote automático da coleta' : `lote automático da coleta${qtd ? ` (${coleta.material === 'fruto' ? 'frutos' : 'material'}: ${qtd})` : ''}; pesar as sementes limpas e lançar como ajuste`,
  };
}
