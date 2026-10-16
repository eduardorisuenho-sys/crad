/**
 * Catálogo público: lido do servidor sem login. A última versão fica guardada
 * no aparelho para abrir sem internet.
 */
import type { ItemCatalogo, RastreioPublico, ResumoCatalogo, Transparencia } from '@crads/dominio';
import { descobrirServidor, servidorGuardado } from '../../dados/sessao';

export function servidorPublico(servidorDaSessao?: string): string {
  if (servidorDaSessao) return servidorDaSessao;
  return servidorGuardado();
}

export function urlFoto(servidor: string, foto: { id: string; arquivo: string; miniatura?: string; colecao?: string }, grande = false): string {
  const nome = !grande && foto.miniatura ? foto.miniatura : foto.arquivo;
  // Foto das mudas tirada no viveiro: rota pública própria.
  if (foto.colecao === 'foto') return `${servidor.replace(/\/$/, '')}/api/crads/publico/foto/${foto.id}/${nome}`;
  return `${servidor.replace(/\/$/, '')}/api/files/especie_foto/${foto.id}/${nome}`;
}

export interface Resposta<T> {
  dados: T;
  /** veio da cópia guardada (sem internet) */
  guardado: boolean;
  em: string;
  /** servidor que respondeu (para as fotos) */
  servidor: string;
}

async function buscar<T>(servidor: string, caminho: string, token?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${servidor.replace(/\/$/, '')}${caminho}`, token ? { headers: { authorization: token } } : undefined);
  } catch {
    throw Object.assign(new Error('Sem internet.'), { rede: true });
  }
  if (r.status === 404 && /json/.test(r.headers.get('content-type') ?? '')) throw Object.assign(new Error('Não encontrado.'), { naoEncontrado: true });
  // endereço errado costuma devolver uma página, não os dados
  if (!r.ok || !/json/.test(r.headers.get('content-type') ?? '')) throw Object.assign(new Error(`Erro ${r.status}`), { rede: true });
  return (await r.json()) as T;
}

async function lerComCopia<T>(servidor: string, caminho: string, token?: string): Promise<Resposta<T>> {
  const chave = `crads_publico_${caminho}`;
  try {
    let usado = servidor;
    let dados: T;
    try {
      dados = await buscar<T>(servidor, caminho, token);
    } catch (err) {
      if (!(err as { rede?: boolean }).rede) throw err;
      // o endereço não respondeu: acha o servidor certo e tenta de novo
      usado = await descobrirServidor(true);
      if (usado.replace(/\/$/, '') === servidor.replace(/\/$/, '')) throw err;
      dados = await buscar<T>(usado, caminho, token);
    }
    const em = new Date().toISOString();
    try {
      localStorage.setItem(chave, JSON.stringify({ dados, em }));
    } catch {
      /* sem espaço: segue sem guardar */
    }
    return { dados, guardado: false, em, servidor: usado };
  } catch (err) {
    if ((err as { naoEncontrado?: boolean }).naoEncontrado) throw err;
    try {
      const c = JSON.parse(localStorage.getItem(chave) ?? 'null');
      if (c) return { dados: c.dados as T, guardado: true, em: c.em, servidor };
    } catch {
      /* cópia ilegível */
    }
    throw new Error('Sem internet e sem cópia guardada deste conteúdo.');
  }
}

export const lerCatalogo = (s: string) => lerComCopia<{ itens: ItemCatalogo[]; gerado_em: string; regras?: number; resumo?: ResumoCatalogo }>(s, '/api/crads/publico/catalogo');

export interface EspeciePublica {
  ficha: Record<string, unknown> & { id: string; nome_cientifico: string };
  nomes_populares: string[];
  fotos: { id: string; parte: string; arquivo: string; miniatura: string; credito: string; colecao?: string }[];
  lotes: { disponivel: number; viveiro: string; rastreio: RastreioPublico }[];
}
export const lerEspecie = (s: string, id: string) => lerComCopia<EspeciePublica>(s, `/api/crads/publico/especie/${encodeURIComponent(id)}`);
export const lerRastreio = (s: string, codigo: string) => lerComCopia<RastreioPublico>(s, `/api/crads/publico/rastreio/${encodeURIComponent(codigo.trim().toUpperCase())}`);
/** Resultados das doações: só com login (vai o token). */
export const lerTransparencia = (s: string, token: string) => lerComCopia<Transparencia & { gerado_em: string }>(s, '/api/crads/publico/transparencia', token);
