import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EPISODIOS } from '../src/modulos/ajuda/episodios.gerado';
import { formatarDuracao, separarPorPerfil } from '../src/modulos/ajuda/episodios';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const roteiros = join(raiz, '../docs/tutorial/episodios');

describe('vídeos de ajuda', () => {
  it('a lista do app é a dos roteiros (título, perfil e ordem) e os arquivos existem', () => {
    const arquivos = readdirSync(roteiros).filter((f) => f.endsWith('.json')).sort();
    expect(EPISODIOS.map((e) => e.numero)).toEqual(arquivos.map((f) => Number(f.slice(0, 2))));
    for (const [k, f] of arquivos.entries()) {
      const r = JSON.parse(readFileSync(join(roteiros, f), 'utf8'));
      expect(EPISODIOS[k]).toMatchObject({ titulo: r.titulo, perfis: r.perfis });
      for (const caminho of [EPISODIOS[k].video, EPISODIOS[k].capa]) expect(existsSync(join(raiz, 'public', caminho))).toBe(true);
    }
  });

  it('os do perfil vêm primeiro; "Todos" é de todo mundo; o administrador vê tudo como seu', () => {
    const coletor = separarPorPerfil(EPISODIOS, ['coletor']);
    expect(coletor.paraVoce.map((e) => e.numero)).toEqual([1, 2, 3, 4]);
    expect(coletor.outros).toHaveLength(8);
    expect(separarPorPerfil(EPISODIOS, ['solicitante']).paraVoce.map((e) => e.numero)).toEqual([1, 2, 8, 11]);
    expect(separarPorPerfil(EPISODIOS, [], true).outros).toHaveLength(0);
  });

  it('duração em minutos e segundos', () => {
    expect(formatarDuracao(45)).toBe('45 s');
    expect(formatarDuracao(65)).toBe('1 min 05 s');
  });
});
