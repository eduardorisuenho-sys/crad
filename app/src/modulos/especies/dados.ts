/** Leitura e gravação das espécies no banco do aparelho. */
import { normalizarBusca, type EntradaBusca, type Existentes, type PlanoFlora, type PlanoImportacao, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';
import type { Repositorio } from '../../dados/repositorio';

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);

export async function carregarExistentes(db: BancoCrads): Promise<Existentes> {
  return {
    especies: ativos(await db.colecao('especie').toArray()) as unknown as Existentes['especies'],
    nomesPopulares: ativos(await db.colecao('nome_popular').toArray()) as unknown as Existentes['nomesPopulares'],
    sinonimos: ativos(await db.colecao('sinonimo').toArray()) as unknown as Existentes['sinonimos'],
  };
}

/** Tudo o que a busca por nome precisa: populares, científicos e sinônimos. */
export async function indiceBusca(db: BancoCrads): Promise<EntradaBusca[]> {
  const e: EntradaBusca[] = [];
  for (const r of ativos(await db.colecao('especie').toArray())) e.push({ especie_id: r.id, nome: String(r.nome_cientifico), tipo: 'cientifico' });
  for (const r of ativos(await db.colecao('nome_popular').toArray())) e.push({ especie_id: String(r.especie_id), nome: String(r.nome), tipo: 'popular' });
  for (const r of ativos(await db.colecao('sinonimo').toArray())) e.push({ especie_id: String(r.especie_id), nome: String(r.nome), tipo: 'sinonimo' });
  return e;
}

export async function nomesPopularesDe(db: BancoCrads, especieId: string): Promise<Registro[]> {
  return ativos(await db.colecao('nome_popular').where('especie_id').equals(especieId).toArray());
}

export function adicionarNomePopular(repo: Repositorio, especieId: string, nome: string) {
  return repo.salvar('nome_popular', { especie_id: especieId, nome, nome_busca: normalizarBusca(nome) });
}

type Progresso = (feito: number, total: number) => void;

/** Grava o plano da planilha: espécies novas, fichas completadas e nomes populares. */
export async function aplicarPlanilha(repo: Repositorio, plano: PlanoImportacao, progresso: Progresso = () => {}) {
  const total = plano.novas.length + plano.atualizadas.length;
  let feito = 0;
  for (const n of plano.novas) {
    const e = await repo.salvar('especie', n.dados);
    for (const p of n.nomesPopulares) await adicionarNomePopular(repo, e.id, p);
    progresso(++feito, total);
  }
  for (const a of plano.atualizadas) {
    if (Object.keys(a.dados).length) await repo.salvar('especie', a.dados, a.especie_id);
    for (const p of a.nomesPopulares) await adicionarNomePopular(repo, a.especie_id, p);
    progresso(++feito, total);
  }
}

/** Grava o plano da Flora e Funga, incluindo sinônimos e ocorrência por bioma na UF. */
export async function aplicarFlora(repo: Repositorio, plano: PlanoFlora, uf: string, progresso: Progresso = () => {}) {
  const total = plano.novas.length + plano.atualizadas.length;
  let feito = 0;
  const extras = async (id: string, populares: string[], sinonimos: string[], biomas: string[]) => {
    for (const p of populares) await adicionarNomePopular(repo, id, p);
    for (const s of sinonimos) await repo.salvar('sinonimo', { especie_id: id, nome: s });
    for (const b of biomas.length ? biomas : ['']) await repo.salvar('especie_ocorrencia', { especie_id: id, uf, bioma: b, origem: 'flora_funga' });
  };
  for (const n of plano.novas) {
    const e = await repo.salvar('especie', n.dados);
    await extras(e.id, n.nomesPopulares, n.sinonimos, n.biomas);
    progresso(++feito, total);
  }
  for (const a of plano.atualizadas) {
    if (Object.keys(a.dados).length) await repo.salvar('especie', a.dados, a.especie_id);
    await extras(a.especie_id, a.nomesPopulares, a.sinonimos, a.biomas);
    progresso(++feito, total);
  }
}
