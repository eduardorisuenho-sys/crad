/**
 * Códigos legíveis do lote: MT-0123 → LS-2026-045 → LM-2026-045-A → DO-2026-310.
 *
 * MT, LS e DO saem de faixas reservadas para cada aparelho, assim o código
 * nasce definitivo mesmo sem internet. Quando a faixa acaba, o aparelho usa um
 * código provisório (ex.: MT-P-ab12-3) e o servidor troca na sincronização.
 * LM herda o número do LS e recebe uma letra (A, B, C…).
 */
import type { PrefixoCodigo } from './esquema';

export interface FaixaCodigo {
  tipo: Exclude<PrefixoCodigo, 'LM'>;
  /** 0 para tipos sem ano (MT) */
  ano: number;
  inicio: number;
  fim: number;
  /** último número já usado; inicio - 1 quando nenhum foi usado */
  ultimo: number;
}

export const TIPOS_COM_ANO: ReadonlySet<string> = new Set(['LS', 'DO']);

const pad = (n: number, tam: number) => String(n).padStart(tam, '0');

export function codigoMatriz(numero: number): string {
  return `MT-${pad(numero, 4)}`;
}
export function codigoLoteSementes(ano: number, numero: number): string {
  return `LS-${ano}-${pad(numero, 3)}`;
}
export function codigoDoacao(ano: number, numero: number): string {
  return `DO-${ano}-${pad(numero, 3)}`;
}

export function formatarCodigo(tipo: FaixaCodigo['tipo'], ano: number, numero: number): string {
  if (tipo === 'MT') return codigoMatriz(numero);
  if (tipo === 'LS') return codigoLoteSementes(ano, numero);
  return codigoDoacao(ano, numero);
}

/** 0 → A, 25 → Z, 26 → AA … */
export function letraDoIndice(indice: number): string {
  let s = '';
  let i = indice;
  do {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

export function indiceDaLetra(letra: string): number {
  let i = 0;
  for (const ch of letra) i = i * 26 + (ch.charCodeAt(0) - 64);
  return i - 1;
}

/** LM-2026-045-A a partir de LS-2026-045 e do índice da semeadura. */
export function codigoLoteMudas(codigoLS: string, indice: number): string {
  const ls = lerCodigo(codigoLS);
  if (!ls || ls.tipo !== 'LS') throw new Error(`Código de lote de sementes inválido: ${codigoLS}`);
  return `LM-${ls.ano}-${pad(ls.numero, 3)}-${letraDoIndice(indice)}`;
}

/** Próxima letra livre para um LS, dados os códigos LM já existentes. */
export function proximoCodigoLoteMudas(codigoLS: string, existentes: string[]): string {
  const ls = lerCodigo(codigoLS);
  if (!ls || ls.tipo !== 'LS') throw new Error(`Código de lote de sementes inválido: ${codigoLS}`);
  // Com LS provisório o LM também é provisório: o servidor gera os dois definitivos.
  if (ls.provisorio) throw new Error('Lote de sementes com código provisório: use um código provisório para o lote de mudas.');
  let maior = -1;
  for (const c of existentes) {
    const lm = lerCodigo(c);
    if (lm && lm.tipo === 'LM' && !lm.inicial && lm.ano === ls.ano && lm.numero === ls.numero) maior = Math.max(maior, indiceDaLetra(lm.letra!));
  }
  return codigoLoteMudas(codigoLS, maior + 1);
}

export interface CodigoLido {
  tipo: PrefixoCodigo;
  ano: number;
  numero: number;
  letra?: string;
  provisorio: boolean;
  /** lote de mudas do estoque inicial (LM-2026-I-001) */
  inicial?: boolean;
}

/** LM-2026-I-001: mudas que já estavam no viveiro antes do app (sem lote de sementes). */
export function codigoEstoqueInicial(ano: number, numero: number): string {
  return `LM-${ano}-I-${pad(numero, 3)}`;
}

export function proximoCodigoEstoqueInicial(ano: number, existentes: string[]): string {
  let maior = 0;
  for (const c of existentes) {
    const lm = lerCodigo(c);
    if (lm?.inicial && lm.ano === ano) maior = Math.max(maior, lm.numero);
  }
  return codigoEstoqueInicial(ano, maior + 1);
}

export function lerCodigo(codigo: string): CodigoLido | null {
  const s = codigo.trim().toUpperCase();
  let m = /^MT-(\d{4,})$/.exec(s);
  if (m) return { tipo: 'MT', ano: 0, numero: Number(m[1]), provisorio: false };
  m = /^(LS|DO)-(\d{4})-(\d{3,})$/.exec(s);
  if (m) return { tipo: m[1] as PrefixoCodigo, ano: Number(m[2]), numero: Number(m[3]), provisorio: false };
  m = /^LM-(\d{4})-I-(\d{3,})$/.exec(s);
  if (m) return { tipo: 'LM', ano: Number(m[1]), numero: Number(m[2]), provisorio: false, inicial: true };
  m = /^LM-(\d{4})-(\d{3,})-([A-Z]+)$/.exec(s);
  if (m) return { tipo: 'LM', ano: Number(m[1]), numero: Number(m[2]), letra: m[3], provisorio: false };
  m = /^(MT|LS|DO|LM)-P-([A-Z0-9]+)-(\d+)$/.exec(s);
  if (m) return { tipo: m[1] as PrefixoCodigo, ano: 0, numero: Number(m[3]), provisorio: true };
  return null;
}

export function ehProvisorio(codigo: string): boolean {
  return lerCodigo(codigo)?.provisorio === true;
}

export function codigoProvisorio(tipo: PrefixoCodigo, dispositivoId: string, contador: number): string {
  return `${tipo}-P-${dispositivoId.slice(0, 4).toUpperCase()}-${contador}`;
}

/**
 * Pega o próximo código das faixas do aparelho. Devolve null quando não há
 * número livre (o chamador usa então um código provisório).
 */
export function proximoDaFaixa(
  faixas: FaixaCodigo[],
  tipo: FaixaCodigo['tipo'],
  ano: number,
): { codigo: string; faixa: FaixaCodigo } | null {
  const anoFaixa = TIPOS_COM_ANO.has(tipo) ? ano : 0;
  const livres = faixas
    .filter((f) => f.tipo === tipo && f.ano === anoFaixa && f.ultimo < f.fim)
    .sort((a, b) => a.inicio - b.inicio);
  const f = livres[0];
  if (!f) return null;
  const numero = Math.max(f.ultimo, f.inicio - 1) + 1;
  return { codigo: formatarCodigo(tipo, anoFaixa, numero), faixa: { ...f, ultimo: numero } };
}

/** Quantos códigos ainda restam para um tipo/ano (para avisar o coletor). */
export function codigosRestantes(faixas: FaixaCodigo[], tipo: FaixaCodigo['tipo'], ano: number): number {
  const anoFaixa = TIPOS_COM_ANO.has(tipo) ? ano : 0;
  return faixas
    .filter((f) => f.tipo === tipo && f.ano === anoFaixa)
    .reduce((s, f) => s + Math.max(0, f.fim - Math.max(f.ultimo, f.inicio - 1)), 0);
}

/** O código pertence a alguma das faixas reservadas pelo aparelho? */
export function codigoNaFaixa(faixas: FaixaCodigo[], codigo: string): boolean {
  const c = lerCodigo(codigo);
  if (!c || c.provisorio || c.tipo === 'LM') return false;
  return faixas.some((f) => f.tipo === c.tipo && f.ano === c.ano && c.numero >= f.inicio && c.numero <= f.fim);
}
