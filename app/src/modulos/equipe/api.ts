/** Chamadas ao servidor para contas e equipe (precisam de internet). */
import type { Sessao } from '../../dados/sessao';

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    throw new Error('Sem internet. Esta parte precisa de conexão.');
  }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((corpo as { message?: string }).message || `Erro ${r.status}`));
  return corpo as T;
}

const base = (s: string) => s.replace(/\/$/, '');

export interface ViveiroPublico {
  id: string;
  nome: string;
  sigla: string;
}
export const viveirosPublicos = (servidor: string) => pedir<ViveiroPublico[]>(`${base(servidor)}/api/crads/publico/viveiros`);

export const criarConta = (servidor: string, d: { nome: string; email: string; senha: string; perfil: string; viveiro_id?: string }) =>
  pedir<{ ok: boolean; pendente: boolean }>(`${base(servidor)}/api/crads/conta`, { method: 'POST', body: JSON.stringify(d) });

export interface DadosEquipe {
  viveiros: { id: string; nome: string }[];
  pedidos: { id: string; nome: string; email: string; perfil: string; viveiro_id: string; criado: string }[];
  pessoas: { usuario_id: string; nome: string; email: string; vinculos: { id: string; viveiro_id: string; perfil: string }[] }[];
}

const comLogin = (s: Sessao, metodo = 'GET', corpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { authorization: s.token },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
});

export const lerEquipe = (s: Sessao) => pedir<DadosEquipe>(`${base(s.servidor)}/api/crads/equipe`, comLogin(s));
export const cadastrarPessoa = (s: Sessao, d: { nome: string; email: string; senha: string; viveiro_id: string; perfil: string }) =>
  pedir<{ ok: boolean; conta_nova: boolean }>(`${base(s.servidor)}/api/crads/equipe/pessoa`, comLogin(s, 'POST', d));
export const responderPedido = (s: Sessao, id: string, aprovar: boolean, motivo = '') => pedir(`${base(s.servidor)}/api/crads/equipe/pedido/${id}`, comLogin(s, 'POST', { aprovar, motivo }));
export const removerAcesso = (s: Sessao, vinculoId: string) => pedir(`${base(s.servidor)}/api/crads/equipe/vinculo/${vinculoId}/remover`, comLogin(s, 'POST', {}));

export const ROTULO_PERFIL: Record<string, string> = { coletor: 'Coletor', viveirista: 'Viveirista', gestor: 'Gestor', solicitante: 'Solicitante' };
