/**
 * Estoque inicial: mudas que já estavam no viveiro quando o app começou a ser
 * usado. Não têm lote de sementes; a origem fica registrada como desconhecida
 * (nada é inventado) e elas entram no catálogo e nas doações normalmente.
 */
import { FASES_MUDA } from './esquema';
import { normalizarBusca } from './especies/nomes';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };

export const ORIGEM_ESTOQUE_INICIAL = 'estoque_inicial';

const ROTULOS_FASE: Record<string, string> = {
  semeadura: 'semeadura',
  germinacao: 'germinacao',
  repicagem: 'repicagem',
  crescimento: 'crescimento',
  rustificacao: 'rustificacao',
  pronta: 'pronta',
  prontas: 'pronta',
  'pronta para doacao': 'pronta',
  'pronta p doacao': 'pronta',
  rustificada: 'rustificacao',
  crescendo: 'crescimento',
};

/** Fase escrita na planilha → fase do app (vazia = pronta). */
export function lerFase(texto: unknown): string | null {
  const t = normalizarBusca(String(texto ?? '')).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return 'pronta';
  if ((FASES_MUDA as readonly string[]).includes(t)) return t;
  return ROTULOS_FASE[t] ?? null;
}

export interface ItemEstoqueInicial {
  especie_id: string;
  quantidade: number;
  fase: string;
  canteiro?: string;
  observacao?: string;
  /** ainda não pronta: o dia em que entra sozinha para doação (AAAA-MM-DD) */
  pronta_em?: string;
  /** linha da planilha (1 = cabeçalho) */
  linha?: number;
}

export function bloqueiosEstoqueInicial(itens: { quantidade: number; fase: string; pronta_em?: string }[], hoje = new Date().toLocaleDateString('sv-SE')): string[] {
  const b: string[] = [];
  for (const i of itens) {
    if (i.fase === 'pronta') continue;
    if (!i.pronta_em || !/^\d{4}-\d{2}-\d{2}$/.test(i.pronta_em)) b.push('Diga quando as mudas ficam prontas para doação.');
    else if (i.pronta_em <= hoje) b.push('A data em que ficam prontas precisa ser depois de hoje. Se já estão prontas, marque “Já estão prontas”.');
  }
  if (!itens.some((i) => i.quantidade > 0)) b.push('Informe a quantidade de pelo menos uma espécie.');
  for (const i of itens) {
    if (i.quantidade && (!Number.isInteger(i.quantidade) || i.quantidade < 0)) b.push('Use números inteiros nas quantidades.');
    if (!(FASES_MUDA as readonly string[]).includes(i.fase)) b.push(`Fase desconhecida: ${i.fase}.`);
  }
  return [...new Set(b)];
}

/** Cabeçalho do modelo de planilha. */
export const COLUNAS_ESTOQUE_INICIAL = ['Espécie', 'Quantidade', 'Canteiro', 'Observação'];

/** Modelo para baixar e preencher (sem dados inventados: só o cabeçalho e um exemplo marcado). */
export function modeloPlanilhaEstoque(): unknown[][] {
  return [COLUNAS_ESTOQUE_INICIAL, ['(exemplo: apague esta linha) Nome popular ou científico', 120, 'Canteiro 3', '']];
}

/**
 * Lê as linhas da planilha (a primeira é o cabeçalho) e acha cada espécie
 * pelo nome científico ou popular, sem diferença de acento e maiúsculas.
 */
export function planejarEstoqueInicial(linhas: unknown[][], especies: Reg[], nomesPopulares: Reg[]): { itens: ItemEstoqueInicial[]; erros: string[] } {
  const erros: string[] = [];
  const itens: ItemEstoqueInicial[] = [];
  const cab = (linhas[0] ?? []).map((c) => normalizarBusca(String(c ?? '')));
  const col = (...nomes: string[]) => cab.findIndex((c) => nomes.some((n) => c.startsWith(n)));
  const cEsp = col('especie', 'nome');
  const cQtd = col('quantidade', 'qtd', 'total');
  const cCant = col('canteiro', 'local');
  const cObs = col('observ');
  if (cEsp < 0 || cQtd < 0) return { itens, erros: ['A planilha precisa das colunas "Espécie" e "Quantidade".'] };

  const porNome = new Map<string, string>();
  const vivas = especies.filter((e) => !e.excluido);
  for (const e of vivas) porNome.set(normalizarBusca(String(e.nome_cientifico ?? '')), e.id);
  for (const n of nomesPopulares) if (!n.excluido) {
    const k = normalizarBusca(String(n.nome ?? ''));
    if (k && !porNome.has(k)) porNome.set(k, String(n.especie_id));
  }

  linhas.slice(1).forEach((l, i) => {
    const linha = i + 2;
    const nome = String(l[cEsp] ?? '').trim();
    const qtdTexto = String(l[cQtd] ?? '').trim();
    if (!nome && !qtdTexto) return;
    if (/^\(exemplo/i.test(nome)) return;
    const especie = porNome.get(normalizarBusca(nome));
    if (!especie) return void erros.push(`Linha ${linha}: espécie "${nome}" não encontrada. Cadastre a espécie antes ou corrija o nome.`);
    const quantidade = Number(qtdTexto.replace(/\./g, '').replace(',', '.'));
    if (!Number.isInteger(quantidade) || quantidade <= 0) return void erros.push(`Linha ${linha}: quantidade inválida (${qtdTexto || 'vazia'}).`);
    // As mudas que já estavam no viveiro entram prontas para doação (a coluna Fase, se houver, é ignorada).
    const fase = 'pronta';
    const texto = (c: number) => (c >= 0 ? String(l[c] ?? '').trim() || undefined : undefined);
    itens.push({ especie_id: especie, quantidade, fase, canteiro: texto(cCant), observacao: texto(cObs), linha });
  });
  return { itens, erros };
}

/** Somar meses a uma data (AAAA-MM-DD), parando no último dia do mês quando ele é menor. */
export function somarMeses(dia: string, meses: number): string {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Lotes de mudas que chegaram ao dia indicado para ficarem prontas: entram
 * sozinhos para doação (fase "pronta"). Lote encerrado ou apagado fica de fora.
 */
export function lotesParaLiberar(lotes: Reg[], hoje: string): Reg[] {
  const dia = hoje.slice(0, 10);
  return lotes.filter((l) => !l.excluido && l.situacao !== 'encerrado' && l.fase_atual !== 'pronta' && typeof l.pronta_em === 'string' && l.pronta_em !== '' && l.pronta_em.slice(0, 10) <= dia);
}
