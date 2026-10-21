/** Vídeos do manual (tela Ajuda). A lista vem de episodios.gerado.ts (gerada dos roteiros). */
import type { Perfil } from '@crads/dominio';

export type PerfilEpisodio = Perfil | 'todos';

export interface Episodio {
  numero: number;
  titulo: string;
  perfis: PerfilEpisodio[];
  video: string;
  capa: string;
  segundos: number;
  bytes: number;
}

export const NOME_PERFIL: Record<PerfilEpisodio, string> = {
  todos: 'Todos',
  coletor: 'Coletor',
  viveirista: 'Viveirista',
  gestor: 'Gestor',
  solicitante: 'Solicitante',
};

/** Episódios do perfil da pessoa primeiro ("Para você"); o administrador vê tudo como seu. */
export function separarPorPerfil(episodios: Episodio[], perfis: PerfilEpisodio[], administrador = false) {
  const meu = (e: Episodio) => administrador || e.perfis.some((p) => p === 'todos' || perfis.includes(p));
  return { paraVoce: episodios.filter(meu), outros: episodios.filter((e) => !meu(e)) };
}

export function formatarDuracao(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

export function formatarTamanho(bytes: number): string {
  return `${(bytes / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
