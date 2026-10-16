/**
 * Login e sessão. A sessão fica salva no aparelho para o app abrir sem
 * internet; ela vale por `dias_sessao_offline` desde o último contato.
 */
import { gerarId, type ContextoUsuario, type FaixaCodigo, type Perfil } from '@crads/dominio';
import type { BancoCrads } from './db';
import { agora } from './relogio';

export interface Sessao extends ContextoUsuario {
  token: string;
  nome: string;
  email: string;
  servidor: string;
  /** último contato bem-sucedido com o servidor */
  validadaEm: string;
  /** pedidos de acesso feitos pela própria pessoa (coletor, viveirista) */
  pedidos_acesso?: { perfil: string; viveiro: string; situacao: string; motivo: string }[];
}

export const SERVIDOR_PADRAO: string = import.meta.env?.VITE_SERVIDOR_URL || 'http://127.0.0.1:8090';
const DIAS_PADRAO = 30;

const ehLocal = (u: string) => /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/.test(u);

/**
 * Servidor escolhido no aparelho (campo "Endereço do servidor"). Um endereço
 * local guardado de antes não vale no app publicado: volta para o padrão.
 */
export function servidorGuardado(): string {
  let s = '';
  try {
    s = localStorage.getItem('crads_servidor') ?? '';
  } catch {
    /* sem acesso ao armazenamento */
  }
  if (!s || (ehLocal(s) && !ehLocal(SERVIDOR_PADRAO) && typeof location !== 'undefined' && !ehLocal(location.hostname))) return SERVIDOR_PADRAO;
  return s;
}

/** Guarda só quando a pessoa escolheu um endereço diferente do padrão. */
export function guardarServidor(s: string) {
  try {
    if (s.trim() && s.trim() !== SERVIDOR_PADRAO) localStorage.setItem('crads_servidor', s.trim());
    else localStorage.removeItem('crads_servidor');
  } catch {
    /* sem acesso ao armazenamento */
  }
}

/** Servidor do piloto (Azure): reserva caso a publicação aponte para um endereço errado. */
export const SERVIDOR_PILOTO = 'https://crads-to-9hfj.mexicocentral.cloudapp.azure.com';

/** Endereços a tentar, na ordem: o que já funcionou aqui, o da publicação e o do piloto. */
export function servidoresCandidatos(): string[] {
  const local = typeof location !== 'undefined' && ehLocal(location.hostname);
  const lista = [servidorGuardado(), SERVIDOR_PADRAO, ...(local ? [] : [SERVIDOR_PILOTO])].map((x) => x.replace(/\/$/, ''));
  return [...new Set(lista.filter(Boolean))];
}

async function responde(servidor: string, ms = 6000): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(`${servidor}/api/health`, { signal: c.signal });
    return r.ok && /json/.test(r.headers.get('content-type') ?? '');
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

let descoberta: Promise<string> | null = null;

/**
 * Acha o servidor sozinho (sem a pessoa digitar endereço): o primeiro da lista
 * que responder fica guardado no aparelho. Sem internet, devolve o primeiro.
 */
export function descobrirServidor(forcar = false): Promise<string> {
  if (descoberta && !forcar) return descoberta;
  descoberta = (async () => {
    const lista = servidoresCandidatos();
    for (const s of lista) {
      if (await responde(s)) {
        guardarServidor(s);
        return s;
      }
    }
    descoberta = null; // sem resposta agora: tenta de novo na próxima vez
    return lista[0];
  })();
  return descoberta;
}

export async function idDispositivo(db: BancoCrads): Promise<string> {
  let id = await db.lerMeta<string | null>('dispositivo_id', null);
  if (!id) {
    id = gerarId();
    await db.gravarMeta('dispositivo_id', id);
  }
  return id;
}

export async function entrar(db: BancoCrads, servidor: string, email: string, senha: string): Promise<Sessao> {
  const base = servidor.replace(/\/$/, '');
  let r: Response;
  try {
    r = await fetch(`${base}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: email, password: senha }),
    });
  } catch {
    throw new Error('Sem internet. Para entrar pela primeira vez é preciso estar conectado.');
  }
  if (!r.ok) throw new Error('E-mail ou senha incorretos.');
  const { token } = await r.json();
  const eu = await (await fetch(`${base}/api/crads/eu`, { headers: { authorization: token } })).json();
  const sessao: Sessao = { ...eu, token, servidor: base, validadaEm: agora() };
  const anterior = await db.lerMeta<Sessao | null>('sessao', null);
  if (anterior && anterior.id !== sessao.id) {
    // Outra pessoa no mesmo aparelho: não mistura os dados.
    const pendentes = await db._fila.count();
    if (pendentes) throw new Error(`Há ${pendentes} alterações de ${anterior.nome} ainda não enviadas. Sincronize antes de trocar de usuário.`);
    await limparDados(db);
  }
  await db.gravarMeta('sessao', sessao);
  return sessao;
}

export async function sessaoSalva(db: BancoCrads): Promise<Sessao | null> {
  const s = await db.lerMeta<Sessao | null>('sessao', null);
  if (!s) return null;
  const dias = await diasSessaoOffline(db);
  const idade = (Date.now() - Date.parse(s.validadaEm)) / 86_400_000;
  return idade <= dias ? s : null;
}

async function diasSessaoOffline(db: BancoCrads): Promise<number> {
  const p = await db.colecao('parametro').where('chave').equals('dias_sessao_offline').first();
  return typeof p?.valor === 'number' ? p.valor : DIAS_PADRAO;
}

/** Atualiza token e perfis quando há internet. Sem internet, mantém o que tem. */
export async function renovar(db: BancoCrads, s: Sessao): Promise<Sessao> {
  try {
    const r = await fetch(`${s.servidor}/api/collections/users/auth-refresh`, { method: 'POST', headers: { authorization: s.token } });
    if (r.status === 401 || r.status === 403) return s;
    if (!r.ok) return s;
    const { token } = await r.json();
    const eu = await (await fetch(`${s.servidor}/api/crads/eu`, { headers: { authorization: token } })).json();
    const nova: Sessao = { ...s, ...eu, token, validadaEm: agora() };
    await db.gravarMeta('sessao', nova);
    return nova;
  } catch {
    return s;
  }
}

export async function sair(db: BancoCrads): Promise<void> {
  await db._meta.delete('sessao');
}

async function limparDados(db: BancoCrads) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) if (t.name !== '_meta') await t.clear();
    await db._meta.where('chave').anyOf('cursor', 'sessao', 'viveiro_atual').delete();
  });
}

/** Perfis do usuário no viveiro atual (gestor geral é gestor em todos). */
export function perfisNoViveiro(s: Sessao, viveiroId?: string): Perfil[] {
  const p = new Set<Perfil>(viveiroId ? s.perfisPorViveiro[viveiroId] ?? [] : []);
  if (s.gestorGeral) p.add('gestor');
  if (s.solicitante) p.add('solicitante');
  return [...p];
}

/** Reserva faixas de códigos para o aparelho (feito ao baixar o pacote de campo). */
export async function reservarFaixas(db: BancoCrads, s: Sessao, dispositivoId: string, tamanho = 20): Promise<FaixaCodigo[]> {
  const ano = new Date().getFullYear();
  const pedidos = (['MT', 'LS', 'DO'] as const).map((tipo) => ({ tipo, ano, quantidade: tamanho }));
  const r = await fetch(`${s.servidor}/api/crads/sync/faixas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: s.token },
    body: JSON.stringify({ dispositivo_id: dispositivoId, pedidos }),
  });
  if (!r.ok) throw new Error('Não foi possível reservar códigos agora.');
  const { faixas } = (await r.json()) as { faixas: FaixaCodigo[] };
  await db._faixas.bulkAdd(faixas);
  return faixas;
}
