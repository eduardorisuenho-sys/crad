import { describe, expect, it } from 'vitest';
import { buscarNaWikipedia } from '../src/plataforma/wikipedia';

/** Wikipédia e Wikidata de mentira: só o que o teste precisa. */
function falso(paginasPorTitulo: Record<string, { title: string; q: string } | null>, busca: { title: string; q: string }[], arvore: Record<string, { nome?: string; rank?: string; pai?: string }>) {
  const chamadas: string[] = [];
  const buscar = async (url: string) => {
    chamadas.push(url);
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    if (u.hostname === 'pt.wikipedia.org') {
      const lista = p.titles !== undefined ? [paginasPorTitulo[p.titles]].filter(Boolean) : busca;
      return { query: { pages: Object.fromEntries((lista as { title: string; q: string; extract?: string }[]).map((x, i) => [String(i), { title: x.title, extract: x.extract, pageprops: { wikibase_item: x.q } }])) } };
    }
    const id = p.ids;
    const e = arvore[id] ?? {};
    const claims: Record<string, unknown[]> = {};
    if (e.nome) claims.P225 = [{ mainsnak: { datavalue: { value: e.nome } } }];
    if (e.rank) claims.P105 = [{ mainsnak: { datavalue: { value: { id: e.rank } } } }];
    if (e.pai) claims.P171 = [{ mainsnak: { datavalue: { value: { id: e.pai } } } }];
    return { entities: { [id]: { claims } } };
  };
  return { buscar, chamadas };
}

const IPE = {
  Q1: { nome: 'Handroanthus albus', rank: 'Q7432', pai: 'Q2' },
  Q2: { nome: 'Handroanthus', rank: 'Q34740', pai: 'Q3' },
  Q3: { nome: 'Bignoniaceae', rank: 'Q35409', pai: 'Q4' },
  Q4: { nome: 'Lamiales', pai: 'Q25314' },
  Q25314: { nome: 'Angiospermae' },
};

describe('nome científico e família pela Wikipédia (via Wikidata)', () => {
  it('acha pela página do nome popular e sobe até a família', async () => {
    const { buscar } = falso({ 'Ipê-amarelo': { title: 'Ipê-amarelo', q: 'Q1' } }, [], IPE);
    expect(await buscarNaWikipedia('Ipê-amarelo', buscar)).toEqual({ nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae', genero: false, url: 'https://pt.wikipedia.org/wiki/Ip%C3%AA-amarelo' });
  });

  it('sem página com o nome, usa a busca; página de gênero vem marcada', async () => {
    const { buscar, chamadas } = falso({}, [{ title: 'Handroanthus', q: 'Q2' }], IPE);
    expect(await buscarNaWikipedia('pau d arco', buscar)).toMatchObject({ nome_cientifico: 'Handroanthus', familia: 'Bignoniaceae', genero: true });
    expect(chamadas.some((c) => c.includes('gsrsearch=pau+d+arco+planta'))).toBe(true);
  });

  it('árvore do Wikidata sem grupo de plantas conhecido: vale se a página fala de planta', async () => {
    const semRaiz = { Q1: IPE.Q1, Q2: IPE.Q2, Q3: { nome: 'Bignoniaceae', rank: 'Q35409' } };
    const comTexto = falso({ Ipê: { title: 'Ipê', q: 'Q1', extract: 'Ipê é uma árvore nativa do Brasil.' } as { title: string; q: string } }, [], semRaiz);
    expect(await buscarNaWikipedia('Ipê', comTexto.buscar)).toMatchObject({ nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae' });
    const semTexto = falso({ Ipê: { title: 'Ipê', q: 'Q1', extract: 'Ipê é um nome.' } as { title: string; q: string } }, [], semRaiz);
    expect(await buscarNaWikipedia('Ipê', semTexto.buscar)).toBeNull();
  });

  it('não é planta (bicho com o mesmo nome) ou não achou: não inventa', async () => {
    const bicho = { Q9: { nome: 'Turdus rufiventris', rank: 'Q7432', pai: 'Q10' }, Q10: { nome: 'Turdidae', rank: 'Q35409', pai: 'Q11' }, Q11: { nome: 'Aves' } };
    expect(await buscarNaWikipedia('Sabiá', falso({ Sabiá: { title: 'Sabiá', q: 'Q9' } }, [], bicho).buscar)).toBeNull();
    expect(await buscarNaWikipedia('Árvore que não existe', falso({}, [], {}).buscar)).toBeNull();
  });
});
