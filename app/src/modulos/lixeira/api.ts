/** Lixeira no servidor (só o administrador, com internet). */
import type { Sessao } from '../../dados/sessao';

export interface ItemLixeira {
  colecao: string;
  tipo: string;
  id: string;
  rotulo: string;
  excluido_em: string;
  por: string;
}

async function pedir<T>(s: Sessao, caminho: string, metodo = 'GET'): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${s.servidor.replace(/\/$/, '')}${caminho}`, { method: metodo, headers: { authorization: s.token } });
  } catch {
    throw new Error('Sem internet. A lixeira precisa de conexão.');
  }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((corpo as { message?: string }).message || `Erro ${r.status}`));
  return corpo as T;
}

export const lerLixeira = (s: Sessao) => pedir<{ itens: ItemLixeira[] }>(s, '/api/crads/lixeira');
export const restaurar = (s: Sessao, col: string, id: string) => pedir(s, `/api/crads/lixeira/${col}/${id}/restaurar`, 'POST');
export const apagarDeVez = (s: Sessao, col: string, id: string) => pedir<{ rotulo: string }>(s, `/api/crads/lixeira/${col}/${id}/apagar`, 'POST');
export const apagarConta = (s: Sessao, usuarioId: string) => pedir(s, `/api/crads/equipe/usuario/${usuarioId}/apagar`, 'POST');
