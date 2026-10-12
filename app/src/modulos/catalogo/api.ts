/**
 * Catálogo público: lido do servidor sem login. A última versão fica guardada
 * no aparelho para abrir sem internet.
 */
import type { ItemCatalogo, RastreioPublico, Transparencia } from '@crads/dominio';
import { servidorGuardado } from '../../dados/sessao';

export function servidorPublico(servidorDaSessao?: string): string {
  if (servidorDaSessao) return servidorDaSessao;
  return servidorGuardado();
}

export function urlFoto(servidor: string, foto: { id: string; arquivo: string; miniatura?: string }, grande = false): string {
  const nome = !grande && foto.miniatura ? foto.miniatura : foto.arquivo;
  return `${servidor.replace(/\/$/, '')}/api/files/especie_foto/${foto.id}/${nome}`;
}

export interface Resposta<T> {
  dados: T;
  /** veio da cópia guardada (sem internet) */
  guardado: boolean;
  em: string;
}

async function lerComCopia<T>(servidor: string, caminho: string): Promise<Resposta<T>> {
  const chave = `crads_publico_${caminho}`;
  try {
    const r = await fetch(`${servidor.replace(/\/$/, '')}${caminho}`);
    if (r.status === 404) throw Object.assign(new Error('Não encontrado.'), { naoEncontrado: true });
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    const dados = (await r.json()) as T;
    const em = new Date().toISOString();
    try {
      localStorage.setItem(chave, JSON.stringify({ dados, em }));
    } catch {
      /* sem espaço: segue sem guardar */
    }
    return { dados, guardado: false, em };
  } catch (err) {
    if ((err as { naoEncontrado?: boolean }).naoEncontrado) throw err;
    try {
      const c = JSON.parse(localStorage.getItem(chave) ?? 'null');
      if (c) return { dados: c.dados as T, guardado: true, em: c.em };
    } catch {
      /* cópia ilegível */
    }
    throw new Error('Sem internet e sem cópia guardada deste conteúdo.');
  }
}

export const lerCatalogo = (s: string) => lerComCopia<{ itens: ItemCatalogo[]; gerado_em: string }>(s, '/api/crads/publico/catalogo');

export interface EspeciePublica {
  ficha: Record<string, unknown> & { id: string; nome_cientifico: string };
  nomes_populares: string[];
  fotos: { id: string; parte: string; arquivo: string; miniatura: string; credito: string }[];
  lotes: { disponivel: number; viveiro: string; rastreio: RastreioPublico }[];
}
export const lerEspecie = (s: string, id: string) => lerComCopia<EspeciePublica>(s, `/api/crads/publico/especie/${encodeURIComponent(id)}`);
export const lerRastreio = (s: string, codigo: string) => lerComCopia<RastreioPublico>(s, `/api/crads/publico/rastreio/${encodeURIComponent(codigo.trim().toUpperCase())}`);
export const lerTransparencia = (s: string) => lerComCopia<Transparencia & { gerado_em: string }>(s, '/api/crads/publico/transparencia');
