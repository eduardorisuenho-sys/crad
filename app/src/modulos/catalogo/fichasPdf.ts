/** Monta as fichas em PDF a partir da ficha pública de cada espécie (com cópia guardada para sem internet). */
import type { ItemCatalogo } from '@crads/dominio';
import { fichasPdf, fotoParaPdf, type FichaPdf } from '../../plataforma/pdfFichas';
import { NOMES_MESES, rotulo } from '../especies/rotulos';
import { lerEspecie, urlFoto, type EspeciePublica } from './api';

/** Caracteres da ficha pública, na ordem em que aparecem. */
export const CARACTERES = ['folha', 'disposicao', 'latex', 'espinhos', 'casca', 'flor', 'fruto', 'origem', 'forma_vida', 'grupo_sucessional'];

const meses = (v: unknown) => (Array.isArray(v) ? (v as number[]).map((m) => NOMES_MESES[m - 1]).join(', ') : '');

/** Ficha da espécie em texto (só o que está cadastrado). */
export function fichaDaEspecie(d: EspeciePublica, destaque?: string): FichaPdf {
  const f = d.ficha;
  const dados: [string, string][] = CARACTERES.filter((c) => f[c]).map((c) => [rotulo(c), String(f[c])]);
  if (meses(f.meses_flor)) dados.push(['Flores', meses(f.meses_flor)]);
  if (meses(f.meses_fruto)) dados.push(['Frutos', meses(f.meses_fruto)]);
  const porViveiro = new Map<string, number>();
  for (const l of d.lotes) porViveiro.set(l.viveiro, (porViveiro.get(l.viveiro) ?? 0) + l.disponivel);
  if (porViveiro.size) dados.push(['Onde tem mudas', [...porViveiro.entries()].map(([v, n]) => `${v} (${n})`).join(', ')]);
  if (f.lorenzi_volume) dados.push(['Referência', `Lorenzi, Árvores Brasileiras, vol. ${String(f.lorenzi_volume)}${f.lorenzi_pagina ? `, p. ${String(f.lorenzi_pagina)}` : ''}`]);
  return {
    nome: d.nomes_populares[0] ?? String(f.nome_cientifico),
    outrosNomes: d.nomes_populares.slice(1),
    cientifico: String(f.nome_cientifico),
    familia: f.familia ? String(f.familia) : undefined,
    dados,
    destaque,
  };
}

/** Sem a ficha pública (sem internet e sem cópia): só os nomes do catálogo. */
export function fichaDoItem(i: Pick<ItemCatalogo, 'nome_cientifico' | 'familia' | 'nomes_populares'>, destaque?: string): FichaPdf {
  return { nome: i.nomes_populares[0] ?? i.nome_cientifico, outrosNomes: i.nomes_populares.slice(1), cientifico: i.nome_cientifico, familia: i.familia || undefined, dados: [], destaque };
}

export interface PedidoDeFicha {
  especie_id: string;
  destaque?: string;
  /** quando a ficha pública não abre */
  reserva?: Pick<ItemCatalogo, 'nome_cientifico' | 'familia' | 'nomes_populares'>;
}

/** Gera o PDF das fichas, uma espécie por vez (avisa o progresso). */
export async function gerarFichasPdf(servidor: string, titulo: string, subtitulo: string, pedidos: PedidoDeFicha[], progresso?: (feitas: number, total: number) => void): Promise<Blob> {
  const fichas: FichaPdf[] = [];
  for (const [n, p] of pedidos.entries()) {
    progresso?.(n, pedidos.length);
    try {
      const d = (await lerEspecie(servidor, p.especie_id)).dados;
      const ficha = fichaDaEspecie(d, p.destaque);
      const foto = d.fotos[0];
      ficha.foto = foto ? await fotoParaPdf(urlFoto(servidor, foto, true)) : null;
      fichas.push(ficha);
    } catch {
      if (p.reserva) fichas.push(fichaDoItem(p.reserva, p.destaque));
    }
  }
  progresso?.(pedidos.length, pedidos.length);
  return fichasPdf(titulo, subtitulo, fichas);
}
