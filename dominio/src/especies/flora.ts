/**
 * Importação da lista da Flora e Funga do Brasil (JBRJ), em dados abertos.
 *
 * A equipe baixa o pacote Darwin Core Archive (.zip) no IPT do JBRJ
 * ("Lista de Espécies da Flora do Brasil") e envia pela tela de
 * administração. O arquivo meta.xml do pacote diz quais colunas existem, por
 * isso a leitura não depende da ordem das colunas.
 *
 * Fica só o que ocorre na UF escolhida (TO), e por padrão só as formas de
 * vida de árvore, arbusto e palmeira.
 */
import { strFromU8, unzipSync } from 'fflate';
import { nomeBase, normalizarBusca } from './nomes';
import type { EspecieExistente } from './importar';

type Linha = Record<string, string>;

export interface Dwca {
  taxon: Linha[];
  vernaculo: Linha[];
  distribuicao: Linha[];
  perfil: Linha[];
}

const nomeTermo = (uri: string) => uri.split(/[/#]/).pop() ?? uri;

function atributo(tag: string, nome: string): string | undefined {
  return new RegExp(`\\s${nome}="([^"]*)"`).exec(tag)?.[1];
}

function desescapar(s: string): string {
  return s.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
}

/** Lê o .zip do Darwin Core Archive. */
export function lerDwca(bytes: Uint8Array): Dwca {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(bytes);
  } catch {
    throw new Error('O arquivo não é um .zip do Darwin Core Archive.');
  }
  const pegar = (nome: string) => {
    const chave = Object.keys(arquivos).find((k) => k === nome || k.endsWith(`/${nome}`));
    return chave ? strFromU8(arquivos[chave]) : '';
  };
  const meta = pegar('meta.xml');
  if (!meta) throw new Error('Pacote sem meta.xml: confira se é o Darwin Core Archive da Flora e Funga.');

  const resultado: Dwca = { taxon: [], vernaculo: [], distribuicao: [], perfil: [] };
  for (const bloco of meta.matchAll(/<(core|extension)\s([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const tag = ` ${bloco[2]}`;
    const tipo = nomeTermo(atributo(tag, 'rowType') ?? '').toLowerCase();
    const destino: keyof Dwca | undefined =
      tipo === 'taxon' ? 'taxon' : tipo === 'vernacularname' ? 'vernaculo' : tipo === 'distribution' ? 'distribuicao' : tipo === 'speciesprofile' ? 'perfil' : undefined;
    if (!destino) continue;
    const local = /<location>([^<]+)<\/location>/.exec(bloco[3])?.[1]?.trim();
    if (!local) continue;
    const sep = desescapar(atributo(tag, 'fieldsTerminatedBy') ?? '\\t');
    const pular = Number(atributo(tag, 'ignoreHeaderLines') ?? '0');
    const colunas: Record<number, string> = {};
    const idTag = /<(id|coreid)\s[^>]*index="(\d+)"/.exec(bloco[3]);
    if (idTag) colunas[Number(idTag[2])] = 'id';
    for (const f of bloco[3].matchAll(/<field\s[^>]*>/g)) {
      const idx = atributo(f[0], 'index');
      const termo = atributo(f[0], 'term');
      if (idx !== undefined && termo) colunas[Number(idx)] = nomeTermo(termo);
    }
    const texto = pegar(local);
    const linhas = texto.split(/\r?\n/);
    for (let i = pular; i < linhas.length; i++) {
      if (!linhas[i]) continue;
      const cel = linhas[i].split(sep);
      const reg: Linha = {};
      for (const [idx, nome] of Object.entries(colunas)) reg[nome] = (cel[Number(idx)] ?? '').trim();
      resultado[destino].push(reg);
    }
  }
  return resultado;
}

const simples = (s: string) => normalizarBusca(s).replace(/ /g, '_');

const BIOMA: Record<string, string> = {
  amazonia: 'amazonia',
  caatinga: 'caatinga',
  cerrado: 'cerrado',
  mata_atlantica: 'mata_atlantica',
  pampa: 'pampa',
  pantanal: 'pantanal',
};
const ORIGEM: Record<string, string> = { nativa: 'nativa', naturalizada: 'naturalizada', cultivada: 'cultivada' };

/** Pega listas dentro de campos JSON da Flora (ex.: {"phytogeographicDomain":["Cerrado"]}). */
function listaJson(texto: string, chave: string): string[] {
  if (!texto) return [];
  try {
    const o = JSON.parse(texto);
    const v = o?.[chave];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return [v];
  } catch {
    /* campo não é JSON: tenta texto solto */
  }
  return texto.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

export interface OpcoesFlora {
  uf: string;
  /** formas de vida aceitas (normalizadas: "arvore", "arbusto", "palmeira"); vazio = todas */
  formasVida: string[];
}

export const FORMAS_VIDA_PADRAO = ['arvore', 'arbusto', 'palmeira'];

export interface EspecieFlora {
  flora_id: string;
  nome_cientifico: string;
  autor: string;
  familia: string;
  origem?: string;
  endemica: boolean;
  forma_vida: string;
  biomas: string[];
  nomesPopulares: string[];
  sinonimos: string[];
}

/** Espécies aceitas que ocorrem na UF, com sinônimos, nomes populares e biomas. */
export function especiesDaFlora(d: Dwca, opcoes: OpcoesFlora): EspecieFlora[] {
  const uf = opcoes.uf.toUpperCase();
  const dist = new Map<string, Linha[]>();
  for (const l of d.distribuicao) (dist.get(l.id) ?? dist.set(l.id, []).get(l.id)!).push(l);
  const perfis = new Map(d.perfil.map((l) => [l.id, l]));
  const vern = new Map<string, string[]>();
  for (const l of d.vernaculo) {
    const idioma = normalizarBusca(l.language ?? '');
    if (idioma && !idioma.startsWith('port') && idioma !== 'pt') continue;
    if (l.vernacularName) (vern.get(l.id) ?? vern.set(l.id, []).get(l.id)!).push(l.vernacularName);
  }
  const sinonimos = new Map<string, string[]>();
  for (const t of d.taxon) {
    if (!simples(t.taxonomicStatus ?? '').startsWith('sinonimo') || !t.acceptedNameUsageID) continue;
    (sinonimos.get(t.acceptedNameUsageID) ?? sinonimos.set(t.acceptedNameUsageID, []).get(t.acceptedNameUsageID)!).push(t.scientificName);
  }

  const saida: EspecieFlora[] = [];
  for (const t of d.taxon) {
    const rank = simples(t.taxonRank ?? '');
    if (!['especie', 'species', 'variedade', 'variety', 'subespecie', 'subspecies'].includes(rank)) continue;
    if (!simples(t.taxonomicStatus ?? '').startsWith('nome_aceito') && simples(t.taxonomicStatus ?? '') !== 'accepted') continue;
    const ocorrencias = (dist.get(t.id) ?? []).filter((l) => (l.locationID ?? '').toUpperCase().replace(/^BR-/, '') === uf);
    if (!ocorrencias.length) continue;
    const perfil = perfis.get(t.id);
    const formas = listaJson(perfil?.lifeForm ?? '', 'lifeForm').map(simples);
    if (opcoes.formasVida.length && !formas.some((f) => opcoes.formasVida.includes(f))) continue;

    const biomas = new Set<string>();
    let endemica = false;
    let origem: string | undefined;
    for (const l of dist.get(t.id) ?? []) {
      for (const b of listaJson(l.occurrenceRemarks ?? '', 'phytogeographicDomain')) if (BIOMA[simples(b)]) biomas.add(BIOMA[simples(b)]);
      if (simples(listaJson(l.occurrenceRemarks ?? '', 'endemism')[0] ?? '') === 'endemica') endemica = true;
    }
    for (const l of ocorrencias) origem ??= ORIGEM[simples(l.establishmentMeans ?? '')];

    saida.push({
      flora_id: t.taxonID || t.id,
      nome_cientifico: t.scientificName,
      autor: t.scientificNameAuthorship ?? '',
      familia: t.family ?? '',
      origem,
      endemica,
      forma_vida: listaJson(perfil?.lifeForm ?? '', 'lifeForm').join(', '),
      biomas: [...biomas],
      nomesPopulares: [...new Set(vern.get(t.id) ?? [])],
      sinonimos: sinonimos.get(t.id) ?? [],
    });
  }
  return saida;
}

export interface PlanoFlora {
  novas: { dados: Record<string, unknown>; nomesPopulares: string[]; sinonimos: string[]; biomas: string[] }[];
  atualizadas: { especie_id: string; dados: Record<string, unknown>; nomesPopulares: string[]; sinonimos: string[]; biomas: string[] }[];
  avisos: string[];
}

/**
 * Cruza a Flora com as espécies já cadastradas (ex.: vindas da planilha).
 * - Mesmo nome: completa a ficha (sem sobrescrever) e liga o flora_id.
 * - Nome da planilha é sinônimo na Flora: marca "revisar" com o nome aceito
 *   (a troca de nome fica para a equipe decidir).
 * - Espécie da UF que ainda não existe: cria sem publicar.
 */
export function planejarFlora(
  flora: EspecieFlora[],
  existentes: { especies: EspecieExistente[]; nomesPopulares: { especie_id: string; nome: string }[]; sinonimos: { especie_id: string; nome: string }[] },
  uf: string,
): PlanoFlora {
  const porBase = new Map(existentes.especies.map((e) => [nomeBase(e.nome_cientifico), e]));
  const jaPopular = new Set(existentes.nomesPopulares.map((n) => `${n.especie_id}|${normalizarBusca(n.nome)}`));
  const jaSinonimo = new Set(existentes.sinonimos.map((n) => `${n.especie_id}|${nomeBase(n.nome)}`));
  const plano: PlanoFlora = { novas: [], atualizadas: [], avisos: [] };
  const usadas = new Set<string>();

  for (const f of flora) {
    const fichaFlora: Record<string, unknown> = {
      flora_id: f.flora_id,
      autor: f.autor,
      familia: f.familia,
      forma_vida: f.forma_vida,
      endemica: f.endemica,
      ...(f.origem ? { origem: f.origem } : {}),
    };
    let alvo = porBase.get(nomeBase(f.nome_cientifico));
    let viaSinonimo = false;
    if (!alvo) {
      for (const s of f.sinonimos) {
        const e = porBase.get(nomeBase(s));
        if (e && !usadas.has(e.id)) {
          alvo = e;
          viaSinonimo = true;
          break;
        }
      }
    }
    if (alvo) {
      usadas.add(alvo.id);
      const dados: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fichaFlora)) if (v !== '' && (alvo[k] === undefined || alvo[k] === null || alvo[k] === '' || alvo[k] === false)) dados[k] = v;
      const notas: string[] = [];
      if (viaSinonimo) notas.push(`na Flora e Funga o nome aceito é ${f.nome_cientifico}`);
      if (alvo.familia && f.familia && alvo.familia !== f.familia) notas.push(`família na Flora e Funga: ${f.familia}`);
      if (notas.length) {
        dados.revisar = true;
        dados.nota_revisao = [alvo.nota_revisao, ...notas].filter(Boolean).join('; ');
        plano.avisos.push(`${alvo.nome_cientifico}: ${notas.join('; ')}`);
      }
      // Os sinônimos da Flora entram (inclusive o nome usado na planilha, quando for um deles).
      const sinonimos = f.sinonimos.filter((s) => !jaSinonimo.has(`${alvo!.id}|${nomeBase(s)}`) && nomeBase(s) !== nomeBase(alvo!.nome_cientifico));
      const nomesPopulares = f.nomesPopulares.filter((n) => !jaPopular.has(`${alvo!.id}|${normalizarBusca(n)}`));
      plano.atualizadas.push({ especie_id: alvo.id, dados, nomesPopulares, sinonimos, biomas: f.biomas });
    } else {
      plano.novas.push({
        dados: { ...fichaFlora, nome_cientifico: f.nome_cientifico, fonte_cadastro: 'flora_funga', publicada: false },
        nomesPopulares: f.nomesPopulares,
        sinonimos: f.sinonimos,
        biomas: f.biomas,
      });
    }
  }
  for (const e of existentes.especies) {
    if (!usadas.has(e.id) && !e.flora_id) plano.avisos.push(`${e.nome_cientifico}: não encontrada na Flora e Funga para ${uf} (pode ser exótica, sinônimo antigo ou erro de grafia).`);
  }
  return plano;
}
