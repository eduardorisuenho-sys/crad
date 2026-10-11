/**
 * Assistente de identificação de espécies (funciona 100% no aparelho).
 *
 * Cada resposta dá pontos às espécies que combinam e tira das que não
 * combinam; "não sei" não pesa. Uma espécie só sai da lista depois de duas
 * respostas contrárias (tolera um engano). Local (bioma/município) e época
 * (flor/fruto no mês) ajudam a ordenar.
 */

export interface PerguntaAssistente {
  id: string;
  texto: string;
  ordem?: number;
  opcoes: { id: string; rotulo: string; figura_padrao?: string }[];
}

export interface EspecieAssistente {
  id: string;
  /** opções marcadas na ficha (ex.: folha composta, flor amarela) */
  opcoes: Set<string>;
  meses_flor?: number[];
  meses_fruto?: number[];
  /** biomas em que ocorre (vazio = sem informação) */
  biomas?: string[];
  /** municípios onde já foi registrada (vazio = sem informação) */
  municipios?: string[];
}

export interface ContextoCampo {
  /** biomas do local (pelo GPS/município) */
  biomas?: string[];
  municipioId?: string;
  /** mês de 1 a 12 */
  mes?: number;
  /** o que o coletor está vendo na árvore agora */
  vendo?: ('flor' | 'fruto')[];
}

export const NAO_SEI = 'nao_sei';
export type Respostas = Record<string, string>;

export interface Candidata {
  especie_id: string;
  pontos: number;
  combina: number;
  contraria: number;
  /** motivos para avisar o coletor ("fora do bioma", "época de flor não bate"…) */
  alertas: string[];
}

const PESO_COMBINA = 3;
const PESO_CONTRARIA = 4;
const MAX_CONTRARIAS = 1;

function mesProximo(meses: number[] | undefined, mes: number): boolean | undefined {
  if (!meses?.length) return undefined;
  const ant = mes === 1 ? 12 : mes - 1;
  const prox = mes === 12 ? 1 : mes + 1;
  return meses.includes(mes) || meses.includes(ant) || meses.includes(prox);
}

/** Opções de cada pergunta (para saber se a espécie tem dado sobre ela). */
function opcoesPorPergunta(perguntas: PerguntaAssistente[]): Map<string, Set<string>> {
  return new Map(perguntas.map((p) => [p.id, new Set(p.opcoes.map((o) => o.id))]));
}

export function pontuar(especies: EspecieAssistente[], perguntas: PerguntaAssistente[], respostas: Respostas, ctx: ContextoCampo = {}): Candidata[] {
  const porPergunta = opcoesPorPergunta(perguntas);
  const saida: Candidata[] = [];
  for (const e of especies) {
    const c: Candidata = { especie_id: e.id, pontos: 0, combina: 0, contraria: 0, alertas: [] };

    // Local: fora do bioma conhecido sai da lista; registrada no município sobe.
    if (ctx.biomas?.length && e.biomas?.length && !e.biomas.some((b) => ctx.biomas!.includes(b))) continue;
    if (ctx.municipioId && e.municipios?.includes(ctx.municipioId)) c.pontos += 2;

    for (const [perguntaId, opcaoId] of Object.entries(respostas)) {
      if (opcaoId === NAO_SEI) continue;
      const daPergunta = porPergunta.get(perguntaId);
      if (!daPergunta) continue;
      const temDado = [...daPergunta].some((o) => e.opcoes.has(o));
      if (!temDado) continue;
      if (e.opcoes.has(opcaoId)) {
        c.pontos += PESO_COMBINA;
        c.combina++;
      } else {
        c.pontos -= PESO_CONTRARIA;
        c.contraria++;
      }
    }

    if (ctx.mes) {
      for (const [parte, meses] of [
        ['flor', e.meses_flor],
        ['fruto', e.meses_fruto],
      ] as const) {
        if (!ctx.vendo?.includes(parte)) continue;
        const ok = mesProximo(meses, ctx.mes);
        if (ok === true) c.pontos += 1;
        if (ok === false) {
          c.pontos -= 1;
          c.alertas.push(`${parte === 'flor' ? 'flores' : 'frutos'} fora da época conhecida`);
        }
      }
    }
    if (c.contraria <= MAX_CONTRARIAS) saida.push(c);
  }
  return saida.sort((a, b) => b.pontos - a.pontos || b.combina - a.combina);
}

/**
 * Próxima pergunta: a que melhor divide as candidatas que restam (entre as
 * que têm dado). Perguntas em que nenhuma candidata tem dado são puladas.
 */
export function proximaPergunta(candidatas: Candidata[], especies: EspecieAssistente[], perguntas: PerguntaAssistente[], respostas: Respostas): PerguntaAssistente | null {
  const porId = new Map(especies.map((e) => [e.id, e]));
  let melhor: PerguntaAssistente | null = null;
  let melhorValor = 0;
  const ordenadas = [...perguntas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  for (const p of ordenadas) {
    if (p.id in respostas) continue;
    const contagem = new Map<string, number>();
    let comDado = 0;
    for (const c of candidatas) {
      const e = porId.get(c.especie_id);
      if (!e) continue;
      const marcadas = p.opcoes.filter((o) => e.opcoes.has(o.id));
      if (!marcadas.length) continue;
      comDado++;
      for (const o of marcadas) contagem.set(o.id, (contagem.get(o.id) ?? 0) + 1 / marcadas.length);
    }
    if (comDado < 2 || contagem.size < 2) continue;
    // entropia: quanto mais equilibrada a divisão, mais a pergunta ajuda
    let h = 0;
    for (const n of contagem.values()) {
      const q = n / comDado;
      h -= q * Math.log2(q);
    }
    const valor = h * (comDado / candidatas.length);
    if (valor > melhorValor + 1e-9) {
      melhorValor = valor;
      melhor = p;
    }
  }
  return melhor;
}

/** Alertas ao escolher uma espécie (para o coletor confirmar). */
export function alertasDaEscolha(e: EspecieAssistente, ctx: ContextoCampo): string[] {
  const a: string[] = [];
  if (ctx.biomas?.length && e.biomas?.length && !e.biomas.some((b) => ctx.biomas!.includes(b))) a.push('Não há registro desta espécie no bioma deste local.');
  if (ctx.mes && ctx.vendo?.includes('flor') && mesProximo(e.meses_flor, ctx.mes) === false) a.push('Esta espécie não costuma florir neste mês.');
  if (ctx.mes && ctx.vendo?.includes('fruto') && mesProximo(e.meses_fruto, ctx.mes) === false) a.push('Esta espécie não costuma ter frutos neste mês.');
  return a;
}
