/**
 * Planejamento da importação de espécies a partir de uma planilha.
 *
 * Aceita a planilha de controle usada hoje (colunas "Nome Popular", "Família
 * Botânica", "Nome Científico") e o modelo completo do CRADS (com os campos
 * da ficha). Nada é inventado: o que parecer errado é importado com a marca
 * "revisar" e uma nota explicando o motivo.
 */
import { limparNome, nomeBase, normalizarBusca, problemasNome } from './nomes';

/** Campos da ficha que a planilha pode trazer, com os nomes de coluna aceitos. */
export const COLUNAS_ESPECIE: Record<string, { rotulo: string; aceitos: string[]; tipo: 'texto' | 'numero' | 'meses' | 'bool' }> = {
  nome_popular: { rotulo: 'Nome popular', aceitos: ['nome popular', 'nome polular', 'nomes populares', 'popular'], tipo: 'texto' },
  familia: { rotulo: 'Família', aceitos: ['familia', 'familia botanica'], tipo: 'texto' },
  nome_cientifico: { rotulo: 'Nome científico', aceitos: ['nome cientifico', 'cientifico', 'especie'], tipo: 'texto' },
  autor: { rotulo: 'Autor', aceitos: ['autor', 'autoria'], tipo: 'texto' },
  forma_vida: { rotulo: 'Forma de vida', aceitos: ['forma de vida', 'habito'], tipo: 'texto' },
  folha: { rotulo: 'Folha', aceitos: ['folha'], tipo: 'texto' },
  disposicao: { rotulo: 'Disposição das folhas', aceitos: ['disposicao', 'disposicao das folhas'], tipo: 'texto' },
  latex: { rotulo: 'Látex ou resina', aceitos: ['latex', 'latex ou resina'], tipo: 'texto' },
  espinhos: { rotulo: 'Espinhos', aceitos: ['espinhos', 'espinho'], tipo: 'texto' },
  casca: { rotulo: 'Casca', aceitos: ['casca'], tipo: 'texto' },
  flor: { rotulo: 'Flor', aceitos: ['flor', 'flores'], tipo: 'texto' },
  fruto: { rotulo: 'Fruto', aceitos: ['fruto', 'frutos'], tipo: 'texto' },
  meses_flor: { rotulo: 'Meses de flor', aceitos: ['meses de flor', 'floracao', 'meses flor'], tipo: 'meses' },
  meses_fruto: { rotulo: 'Meses de fruto', aceitos: ['meses de fruto', 'frutificacao', 'meses fruto'], tipo: 'meses' },
  lorenzi_volume: { rotulo: 'Lorenzi volume', aceitos: ['lorenzi volume', 'lorenzi vol', 'volume lorenzi'], tipo: 'numero' },
  lorenzi_pagina: { rotulo: 'Lorenzi página', aceitos: ['lorenzi pagina', 'lorenzi pag', 'pagina lorenzi'], tipo: 'numero' },
  sementes_por_kg: { rotulo: 'Sementes por kg', aceitos: ['sementes por kg', 'sementes kg'], tipo: 'numero' },
  dormencia: { rotulo: 'Dormência', aceitos: ['dormencia'], tipo: 'texto' },
  tratamento_pre_germinativo: { rotulo: 'Tratamento pré-germinativo', aceitos: ['tratamento pre germinativo', 'quebra de dormencia', 'tratamento'], tipo: 'texto' },
  dias_germinacao: { rotulo: 'Dias para germinar', aceitos: ['dias para germinar', 'dias germinacao', 'tempo de germinacao'], tipo: 'numero' },
  meses_ate_pronta: { rotulo: 'Meses até a muda ficar pronta', aceitos: ['meses ate a muda ficar pronta', 'meses ate pronta', 'tempo no viveiro'], tipo: 'numero' },
  grupo_sucessional: { rotulo: 'Grupo sucessional', aceitos: ['grupo sucessional', 'grupo ecologico'], tipo: 'texto' },
  origem: { rotulo: 'Origem (nativa/exótica)', aceitos: ['origem', 'origem nativa exotica', 'nativa ou exotica'], tipo: 'texto' },
};

/** Descobre, pelo cabeçalho, qual coluna é qual campo. */
export function mapearCabecalho(cabecalho: unknown[]): Record<number, string> {
  const mapa: Record<number, string> = {};
  cabecalho.forEach((c, i) => {
    const h = normalizarBusca(String(c ?? ''));
    if (!h) return;
    for (const [campo, def] of Object.entries(COLUNAS_ESPECIE)) {
      if (def.aceitos.includes(h) && !Object.values(mapa).includes(campo)) {
        mapa[i] = campo;
        return;
      }
    }
  });
  return mapa;
}

/** Encontra a linha de cabeçalho (a primeira com "nome científico"). */
export function acharCabecalho(linhas: unknown[][], maxLinhas = 20): number {
  for (let i = 0; i < Math.min(linhas.length, maxLinhas); i++) {
    if (Object.values(mapearCabecalho(linhas[i])).includes('nome_cientifico')) return i;
  }
  return -1;
}

export interface LinhaEspecie {
  /** número da linha na planilha (1 = primeira) */
  linha: number;
  [campo: string]: unknown;
}

/** Converte as linhas brutas da planilha em registros, usando o cabeçalho. */
export function lerLinhas(linhas: unknown[][]): { registros: LinhaEspecie[]; erro?: string } {
  const h = acharCabecalho(linhas);
  if (h < 0) return { registros: [], erro: 'Não achei a coluna "Nome científico" nas primeiras 20 linhas.' };
  const mapa = mapearCabecalho(linhas[h]);
  const registros: LinhaEspecie[] = [];
  for (let i = h + 1; i < linhas.length; i++) {
    const reg: LinhaEspecie = { linha: i + 1 };
    let algum = false;
    for (const [col, campo] of Object.entries(mapa)) {
      const v = converter(linhas[i][Number(col)], COLUNAS_ESPECIE[campo].tipo);
      if (v !== undefined) {
        reg[campo] = v;
        algum = true;
      }
    }
    if (algum) registros.push(reg);
  }
  return { registros };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function mes(p: string): number {
  if (/^\d+$/.test(p)) return Number(p) >= 1 && Number(p) <= 12 ? Number(p) : 0;
  const i = MESES.indexOf(p.slice(0, 3));
  return i >= 0 && p.length >= 3 ? i + 1 : 0;
}

function converter(v: unknown, tipo: 'texto' | 'numero' | 'meses' | 'bool'): unknown {
  if (v === null || v === undefined) return undefined;
  const s = limparNome(String(v));
  if (!s) return undefined;
  if (tipo === 'numero') {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (tipo === 'meses') {
    // aceita "9,10,11", "set out nov" e "setembro a novembro"
    const partes = normalizarBusca(s).split(' ');
    const meses: number[] = [];
    for (let i = 0; i < partes.length; i++) {
      const m = mes(partes[i]);
      if (!m) continue;
      const fim = partes[i + 1] === 'a' ? mes(partes[i + 2] ?? '') : 0;
      if (fim) {
        for (let k = m; k !== fim; k = (k % 12) + 1) meses.push(k);
        meses.push(fim);
        i += 2;
      } else meses.push(m);
    }
    return meses.length ? [...new Set(meses)].sort((a, b) => a - b) : undefined;
  }
  if (tipo === 'bool') return /^(s|sim|x|1|true)$/i.test(s);
  return s;
}

// ---------------------------------------------------------------------------

export interface EspecieExistente {
  id: string;
  nome_cientifico: string;
  familia?: string;
  revisar?: boolean;
  nota_revisao?: string;
  [campo: string]: unknown;
}

export interface Existentes {
  especies: EspecieExistente[];
  /** nomes populares já cadastrados (especie_id + nome) */
  nomesPopulares: { especie_id: string; nome: string }[];
  /** sinônimos já cadastrados (ex.: vindos da Flora e Funga) */
  sinonimos: { especie_id: string; nome: string }[];
}

export interface EspecieNova {
  chave: string;
  dados: Record<string, unknown>;
  nomesPopulares: string[];
  linhas: number[];
}

export interface EspecieAtualizada {
  especie_id: string;
  /** só campos que estavam vazios (nunca sobrescreve a ficha) */
  dados: Record<string, unknown>;
  nomesPopulares: string[];
  linhas: number[];
}

export interface PlanoImportacao {
  novas: EspecieNova[];
  atualizadas: EspecieAtualizada[];
  avisos: { linhas: number[]; mensagem: string }[];
  erros: { linha: number; mensagem: string }[];
  resumo: { linhas: number; especies: number; novas: number; atualizadas: number; nomesPopulares: number; paraRevisar: number };
}

const CAMPOS_FICHA = Object.keys(COLUNAS_ESPECIE).filter((c) => !['nome_popular', 'nome_cientifico', 'familia'].includes(c));
const ORIGENS: Record<string, string> = { nativa: 'nativa', exotica: 'exotica', naturalizada: 'naturalizada', cultivada: 'cultivada' };

interface Grupo {
  chave: string;
  nomes: Map<string, number>;
  familias: Set<string>;
  populares: string[];
  ficha: Record<string, unknown>;
  linhas: number[];
  notas: string[];
}

export function planejarImportacao(registros: LinhaEspecie[], existentes: Existentes): PlanoImportacao {
  const erros: PlanoImportacao['erros'] = [];
  const avisos: PlanoImportacao['avisos'] = [];
  const grupos = new Map<string, Grupo>();

  for (const r of registros) {
    const cientifico = limparNome(String(r.nome_cientifico ?? ''));
    if (!cientifico) {
      erros.push({ linha: r.linha, mensagem: `sem nome científico${r.nome_popular ? ` (${r.nome_popular})` : ''}` });
      continue;
    }
    const problemas = problemasNome(cientifico);
    // Nomes com "ou" ficam separados para não misturar duas espécies.
    const chave = problemas.includes('mais de uma espécie no mesmo nome') ? `?${normalizarBusca(cientifico)}` : nomeBase(cientifico);
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, nomes: new Map(), familias: new Set(), populares: [], ficha: {}, linhas: [], notas: [] };
      grupos.set(chave, g);
    }
    g.nomes.set(cientifico, (g.nomes.get(cientifico) ?? 0) + 1);
    if (r.familia) g.familias.add(limparNome(String(r.familia)));
    if (r.nome_popular) {
      // "Pau-de-óleo/Copaíba" → dois nomes populares
      for (const p of String(r.nome_popular).split('/').map(limparNome).filter(Boolean)) {
        if (!g.populares.some((x) => normalizarBusca(x) === normalizarBusca(p))) g.populares.push(p);
      }
    }
    for (const c of CAMPOS_FICHA) if (r[c] !== undefined && g.ficha[c] === undefined) g.ficha[c] = r[c];
    for (const p of problemas) if (!g.notas.includes(p)) g.notas.push(p);
    g.linhas.push(r.linha);
  }

  const porBase = new Map(existentes.especies.map((e) => [nomeBase(e.nome_cientifico), e]));
  const porSinonimo = new Map(existentes.sinonimos.map((s) => [nomeBase(s.nome), s.especie_id]));
  const porId = new Map(existentes.especies.map((e) => [e.id, e]));
  const popularesExistentes = new Set(existentes.nomesPopulares.map((n) => `${n.especie_id}|${normalizarBusca(n.nome)}`));

  const novas: EspecieNova[] = [];
  const atualizadas: EspecieAtualizada[] = [];
  let nomesPopulares = 0;
  let paraRevisar = 0;

  for (const g of grupos.values()) {
    // Nome mais usado; no empate, o mais completo (com autor).
    const nome = [...g.nomes.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    if (g.nomes.size > 1) avisos.push({ linhas: g.linhas, mensagem: `Grafias diferentes juntadas: ${[...g.nomes.keys()].join(' | ')}` });
    const familias = [...g.familias];
    if (familias.length > 1) g.notas.push(`famílias diferentes na planilha: ${familias.join(', ')}`);

    const ficha = { ...g.ficha };
    if (typeof ficha.origem === 'string') {
      const o = ORIGENS[normalizarBusca(ficha.origem)];
      if (o) ficha.origem = o;
      else {
        g.notas.push(`origem não reconhecida: ${ficha.origem}`);
        delete ficha.origem;
      }
    }

    const alvoId = g.chave.startsWith('?') ? undefined : porBase.get(g.chave)?.id ?? porSinonimo.get(g.chave);
    const alvo = alvoId ? porId.get(alvoId) : undefined;

    if (alvo) {
      const dados: Record<string, unknown> = {};
      for (const [c, v] of Object.entries(ficha)) if (alvo[c] === undefined || alvo[c] === null || alvo[c] === '' || alvo[c] === 0) dados[c] = v;
      if (!alvo.familia && familias.length === 1) dados.familia = familias[0];
      else if (alvo.familia && familias.length && !familias.includes(alvo.familia)) g.notas.push(`família na planilha (${familias.join(', ')}) diferente da cadastrada (${alvo.familia})`);
      if (nomeBase(alvo.nome_cientifico) !== g.chave) avisos.push({ linhas: g.linhas, mensagem: `"${nome}" é sinônimo de ${alvo.nome_cientifico}; os nomes populares foram ligados ao nome aceito.` });
      if (g.notas.length) {
        dados.revisar = true;
        dados.nota_revisao = juntarNotas(alvo.nota_revisao, g.notas);
        paraRevisar++;
      }
      const populares = g.populares.filter((p) => !popularesExistentes.has(`${alvo.id}|${normalizarBusca(p)}`));
      nomesPopulares += populares.length;
      if (Object.keys(dados).length || populares.length) atualizadas.push({ especie_id: alvo.id, dados, nomesPopulares: populares, linhas: g.linhas });
    } else {
      const dados: Record<string, unknown> = { ...ficha, nome_cientifico: nome, fonte_cadastro: 'planilha', publicada: false };
      if (familias.length) dados.familia = familias[0];
      if (g.notas.length) {
        dados.revisar = true;
        dados.nota_revisao = juntarNotas('', g.notas);
        paraRevisar++;
      }
      nomesPopulares += g.populares.length;
      novas.push({ chave: g.chave, dados, nomesPopulares: g.populares, linhas: g.linhas });
    }
  }

  // Um mesmo nome popular em espécies diferentes é comum, mas vale avisar.
  const donos = new Map<string, Set<string>>();
  for (const n of novas) for (const p of n.nomesPopulares) (donos.get(normalizarBusca(p)) ?? donos.set(normalizarBusca(p), new Set()).get(normalizarBusca(p))!).add(n.chave);
  for (const [p, chaves] of donos) if (chaves.size > 1) avisos.push({ linhas: [], mensagem: `O nome popular "${p}" aparece em ${chaves.size} espécies.` });

  return {
    novas,
    atualizadas,
    avisos,
    erros,
    resumo: { linhas: registros.length, especies: grupos.size, novas: novas.length, atualizadas: atualizadas.length, nomesPopulares, paraRevisar },
  };
}

function juntarNotas(anterior: unknown, novas: string[]): string {
  const todas = new Set(
    String(anterior ?? '')
      .split('; ')
      .filter(Boolean),
  );
  for (const n of novas) todas.add(n);
  return [...todas].join('; ');
}
