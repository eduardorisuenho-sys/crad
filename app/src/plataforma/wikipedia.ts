/**
 * Busca o nome científico e a família de uma planta pelo nome popular na
 * Wikipédia em português. O nome e a família vêm do Wikidata ligado à página
 * (dados estruturados, não do texto do artigo). Só aceita página de planta.
 * Nada é inventado: sem achar, devolve null e a pessoa preenche.
 */
export interface ResultadoWikipedia {
  nome_cientifico: string;
  familia: string;
  /** página usada (para conferir) */
  url: string;
  /** a página é de um gênero (vários tipos de "ipê", por exemplo), não de uma espécie */
  genero: boolean;
}

type Buscar = (url: string) => Promise<unknown>;

const WIKI = 'https://pt.wikipedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const RANK_FAMILIA = 'Q35409';
const RANK_GENERO = 'Q34740';
/** Grupos que provam que é planta: Plantae, plantas verdes, terrestres, vasculares, com semente, angiospermas. */
const PLANTAS = new Set(['Q756', 'Q879', 'Q19832486', 'Q27133', 'Q25821', 'Q25314']);

const buscarJson: Buscar = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  return r.json();
};

const qs = (p: Record<string, string>) => new URLSearchParams({ format: 'json', origin: '*', ...p }).toString();

interface Pagina {
  title: string;
  missing?: unknown;
  pageprops?: { wikibase_item?: string };
  extract?: string;
}

async function paginas(buscar: Buscar, p: Record<string, string>): Promise<Pagina[]> {
  const j = (await buscar(`${WIKI}?${qs({ action: 'query', redirects: '1', prop: 'pageprops|extracts', ppprop: 'wikibase_item', exintro: '1', explaintext: '1', exsentences: '3', ...p })}`)) as { query?: { pages?: Record<string, Pagina> } };
  return Object.values(j.query?.pages ?? {}).filter((x) => x.missing === undefined && x.pageprops?.wikibase_item);
}

interface Entidade {
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
}

async function entidades(buscar: Buscar, ids: string[]): Promise<Record<string, Entidade>> {
  const j = (await buscar(`${WIKIDATA}?${qs({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims' })}`)) as { entities?: Record<string, Entidade> };
  return j.entities ?? {};
}

const valor = (e: Entidade | undefined, p: string): unknown => e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
const idDe = (v: unknown): string | undefined => (v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : undefined);

/** Sobe na árvore dos táxons (P171) até achar a família e conferir que é planta. */
async function taxonDaEntidade(buscar: Buscar, id: string): Promise<{ nome: string; familia: string; genero: boolean; planta: boolean } | null> {
  const todas = await entidades(buscar, [id]);
  const e = todas[id];
  const nome = valor(e, 'P225');
  if (typeof nome !== 'string' || !nome) return null;
  const genero = idDe(valor(e, 'P105')) === RANK_GENERO;
  let familia = '';
  let atual = idDe(valor(e, 'P171'));
  for (let passos = 0; atual && passos < 25; passos++) {
    const pai = (await entidades(buscar, [atual]))[atual];
    if (!familia && idDe(valor(pai, 'P105')) === RANK_FAMILIA) familia = String(valor(pai, 'P225') ?? '');
    if (PLANTAS.has(atual)) return { nome, familia, genero, planta: true };
    atual = idDe(valor(pai, 'P171'));
  }
  // não chegou a um grupo de plantas conhecido: quem decide é o texto da página
  return { nome, familia, genero, planta: false };
}

/** Procura pelo nome popular: primeiro a página com esse título, depois a busca. */
export async function buscarNaWikipedia(nomePopular: string, buscar: Buscar = buscarJson): Promise<ResultadoWikipedia | null> {
  const nome = nomePopular.trim();
  if (!nome) return null;
  const candidatas = [...(await paginas(buscar, { titles: nome }))];
  if (!candidatas.length) candidatas.push(...(await paginas(buscar, { generator: 'search', gsrsearch: `${nome} planta`, gsrlimit: '3' })));
  for (const p of candidatas) {
    const t = await taxonDaEntidade(buscar, p.pageprops!.wikibase_item!);
    const textoDePlanta = /(planta|árvore|arbusto|palmeira|vegeta|botânic|angiosp)/i.test(p.extract ?? '');
    if (t && t.familia && (t.planta || textoDePlanta)) return { nome_cientifico: t.nome, familia: t.familia, genero: t.genero, url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` };
  }
  return null;
}
