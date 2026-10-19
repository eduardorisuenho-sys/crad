import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BancoCrads } from '../src/dados/db';
import { Repositorio } from '../src/dados/repositorio';
import { completarEspeciesPelaWikipedia, NOTA_NAO_ACHOU } from '../src/modulos/especies/completarWikipedia';
import { adicionarNomePopular } from '../src/modulos/especies/dados';

let n = 0;
function aparelho() {
  const db = new BancoCrads(`wiki-${++n}`);
  const repo = new Repositorio(db, () => ({ dispositivoId: 'aparelho0000099', viveiroId: undefined }));
  return { db, repo };
}

describe('completar espécie pela Wikipédia', () => {
  it('só com o nome popular: completa nome científico e família e marca para conferir', async () => {
    const { db, repo } = aparelho();
    const e = await repo.salvar('especie', { fonte_cadastro: 'manual' });
    await adicionarNomePopular(repo, e.id, 'Ipê-amarelo');
    const buscas: string[] = [];
    const feitas = await completarEspeciesPelaWikipedia(db, repo, async (nome) => {
      buscas.push(nome);
      return { nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae', genero: false, url: 'https://pt.wikipedia.org/wiki/Ip%C3%AA-amarelo' };
    });
    expect(feitas).toBe(1);
    expect(buscas).toEqual(['Ipê-amarelo']);
    expect(await db.colecao('especie').get(e.id)).toMatchObject({ nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae', revisar: true, nota_revisao: expect.stringContaining('pt.wikipedia.org') });
  });

  it('não sobrescreve o que a pessoa preencheu; avisa quando a espécie já existe', async () => {
    const { db, repo } = aparelho();
    await repo.salvar('especie', { nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae' });
    const e = await repo.salvar('especie', { nome_cientifico: 'Handroanthus albus' });
    await adicionarNomePopular(repo, e.id, 'Ipê');
    await completarEspeciesPelaWikipedia(db, repo, async () => ({ nome_cientifico: 'Outro nome', familia: 'Bignoniaceae', genero: false, url: 'u' }));
    const r = await db.colecao('especie').get(e.id);
    expect(r).toMatchObject({ nome_cientifico: 'Handroanthus albus', familia: 'Bignoniaceae' });
    expect(String(r!.nota_revisao)).toContain('Já existe a espécie Handroanthus albus no app');
  });

  it('não achou: marca para preencher à mão e só tenta de novo no dia seguinte; sem internet tenta depois', async () => {
    const { db, repo } = aparelho();
    const e = await repo.salvar('especie', {});
    await adicionarNomePopular(repo, e.id, 'Árvore-sem-página');
    let chamadas = 0;
    const nada = async () => {
      chamadas++;
      return null;
    };
    await completarEspeciesPelaWikipedia(db, repo, nada, 1_000);
    expect((await db.colecao('especie').get(e.id))?.nota_revisao).toBe(NOTA_NAO_ACHOU);
    await completarEspeciesPelaWikipedia(db, repo, nada, 2_000);
    expect(chamadas).toBe(1);
    await completarEspeciesPelaWikipedia(db, repo, nada, 1_000 + 86_400_000);
    expect(chamadas).toBe(2);

    const outra = aparelho();
    const x = await outra.repo.salvar('especie', {});
    await adicionarNomePopular(outra.repo, x.id, 'Pequi');
    const semRede = async () => {
      throw new TypeError('sem rede');
    };
    expect(await completarEspeciesPelaWikipedia(outra.db, outra.repo, semRede)).toBe(0);
    expect((await outra.db.lerMeta<Record<string, number>>('wikipedia_tentativas', {}))[x.id]).toBeUndefined();
  });
});
