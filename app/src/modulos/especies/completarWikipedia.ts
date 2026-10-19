/**
 * Espécies sem nome científico ou família: assim que houver internet, o app
 * busca na Wikipédia (pt) pelo nome popular e completa. Fica marcada para
 * revisar, com a página usada. Sem achar, marca para preencher à mão.
 */
import { normalizarBusca, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';
import type { Repositorio } from '../../dados/repositorio';
import { buscarNaWikipedia, type ResultadoWikipedia } from '../../plataforma/wikipedia';
import { nomesPopularesDe } from './dados';

const UM_DIA = 86_400_000;
export const NOTA_NAO_ACHOU = 'Não achamos na Wikipédia: preencha o nome científico e a família.';

/** Devolve quantas espécies foram completadas. */
export async function completarEspeciesPelaWikipedia(db: BancoCrads, repo: Repositorio, buscar: (nome: string) => Promise<ResultadoWikipedia | null> = buscarNaWikipedia, agora = Date.now(), limite = 20): Promise<number> {
  const todas = (await db.colecao('especie').toArray()).filter((e) => !e.excluido) as Registro[];
  const faltando = todas.filter((e) => !String(e.nome_cientifico ?? '').trim() || !String(e.familia ?? '').trim());
  if (!faltando.length) return 0;
  const tentativas = await db.lerMeta<Record<string, number>>('wikipedia_tentativas', {});
  let completadas = 0;
  let feitas = 0;
  for (const e of faltando) {
    if (feitas >= limite) break; // no máximo 20 por rodada, para não sobrecarregar a Wikipédia
    if (tentativas[e.id] !== undefined && agora - tentativas[e.id] < UM_DIA) continue;
    const nome = String((await nomesPopularesDe(db, e.id))[0]?.nome ?? '').trim();
    if (!nome) continue;
    let r: ResultadoWikipedia | null;
    try {
      r = await buscar(nome);
    } catch {
      return completadas; // sem internet ou a Wikipédia não respondeu: tenta de novo depois
    }
    feitas++;
    tentativas[e.id] = agora;
    await db.gravarMeta('wikipedia_tentativas', tentativas);
    if (!r) {
      if (e.nota_revisao !== NOTA_NAO_ACHOU) await repo.salvar('especie', { revisar: true, nota_revisao: NOTA_NAO_ACHOU }, e.id);
      continue;
    }
    const cientifico = String(e.nome_cientifico ?? '').trim() || r.nome_cientifico;
    const igual = todas.find((x) => x.id !== e.id && normalizarBusca(String(x.nome_cientifico ?? '')) === normalizarBusca(cientifico));
    const notas = [
      `Nome científico e família preenchidos pela Wikipédia (${r.url}): confira.`,
      r.genero ? 'A página é do gênero: complete o nome da espécie.' : '',
      igual ? `Já existe a espécie ${String(igual.nome_cientifico)} no app: junte as duas.` : '',
    ].filter(Boolean);
    await repo.salvar(
      'especie',
      {
        ...(String(e.nome_cientifico ?? '').trim() ? {} : { nome_cientifico: r.nome_cientifico }),
        ...(String(e.familia ?? '').trim() ? {} : { familia: r.familia }),
        revisar: true,
        nota_revisao: notas.join(' '),
      },
      e.id,
    );
    completadas++;
  }
  return completadas;
}
