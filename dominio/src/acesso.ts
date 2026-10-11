/** Quem pode ler e escrever o quê, por perfil e por viveiro. */
import type { Colecao, Perfil } from './esquema';

export interface ContextoUsuario {
  id: string;
  /** gestor com acesso a todos os viveiros */
  gestorGeral: boolean;
  /** perfis do usuário em cada viveiro (id do viveiro → perfis) */
  perfisPorViveiro: Record<string, Perfil[]>;
  /** usuário cadastrado como solicitante de mudas */
  solicitante: boolean;
}

/** Perfis que valem para um registro, considerando o viveiro dele. */
export function perfisPara(ctx: ContextoUsuario, viveiroId?: unknown): Set<Perfil> {
  const s = new Set<Perfil>();
  if (ctx.gestorGeral) s.add('gestor');
  if (ctx.solicitante) s.add('solicitante');
  if (typeof viveiroId === 'string' && viveiroId) {
    for (const p of ctx.perfisPorViveiro[viveiroId] ?? []) s.add(p);
  } else {
    for (const ps of Object.values(ctx.perfisPorViveiro)) for (const p of ps) s.add(p);
  }
  return s;
}

/** Viveiros que o usuário enxerga. null = todos (gestor geral). */
export function viveirosVisiveis(ctx: ContextoUsuario): string[] | null {
  return ctx.gestorGeral ? null : Object.keys(ctx.perfisPorViveiro);
}

function viaDono(col: Colecao, perfis: Set<Perfil>, permitidos: Perfil[]): boolean {
  // O solicitante é o único perfil limitado aos próprios registros.
  for (const p of perfis) if (p !== 'solicitante' && permitidos.includes(p)) return false;
  return perfis.has('solicitante') && permitidos.includes('solicitante') && !!col.campoDono;
}

export function podeLer(ctx: ContextoUsuario, col: Colecao, reg: Record<string, unknown>): boolean {
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : undefined);
  if (col.leitura === 'todos') {
    // Solicitante só vê os registros dele nas coleções que têm dono.
    if (col.campoDono && perfis.size === 1 && perfis.has('solicitante')) return reg[col.campoDono] === ctx.id;
    if (col.porViveiro && !perfis.size) return false;
    return perfis.size > 0 || !col.porViveiro;
  }
  if (viaDono(col, perfis, col.leitura)) return reg[col.campoDono!] === ctx.id;
  for (const p of perfis) if (col.leitura.includes(p)) return true;
  return false;
}

export function podeEscrever(ctx: ContextoUsuario, col: Colecao, reg: Record<string, unknown>): boolean {
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : undefined);
  if (viaDono(col, perfis, col.escrita)) return reg[col.campoDono!] === ctx.id;
  for (const p of perfis) if (col.escrita.includes(p)) return true;
  return false;
}

/** O usuário está escrevendo só como solicitante (então o registro tem de ser dele)? */
export function escreveComoSolicitante(ctx: ContextoUsuario, col: Colecao, reg: Record<string, unknown>): boolean {
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : undefined);
  return viaDono(col, perfis, col.escrita);
}
