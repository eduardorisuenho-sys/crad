/** Municípios guardados no aparelho: achar pelo GPS ou pelo nome, sem internet. */
import { indiceMunicipios, municipioPeloNome, type Ponto, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';

let cache: { chave: string; idx: ReturnType<typeof indiceMunicipios<Registro>>; lista: Registro[] } | null = null;

export async function listaMunicipios(db: BancoCrads): Promise<Registro[]> {
  const lista = (await db.colecao('municipio').toArray()).filter((m) => !m.excluido);
  return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

async function indice(db: BancoCrads) {
  const lista = await listaMunicipios(db);
  const chave = lista.map((m) => `${m.id}:${m.versao ?? ''}`).join(',');
  if (!cache || cache.chave !== chave) cache = { chave, idx: indiceMunicipios(lista), lista };
  return cache;
}

/** Município que contém o ponto (null se a base não foi importada ou o ponto está fora). */
export async function municipioDoPonto(db: BancoCrads, p: Ponto | null | undefined): Promise<Registro | null> {
  if (!p) return null;
  return (await indice(db)).idx.doPonto(p);
}

export async function municipioDoNome(db: BancoCrads, nome: string): Promise<Registro | null> {
  return municipioPeloNome(nome, (await indice(db)).lista);
}
