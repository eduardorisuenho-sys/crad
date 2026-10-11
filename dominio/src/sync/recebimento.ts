/** Regras do "puxar alterações": o que cada usuário recebe. */
import { podeLer, type ContextoUsuario } from '../acesso';
import type { Colecao } from '../esquema';
import type { Registro, RespostaRecebimento } from './tipos';

/**
 * Junta os registros de várias coleções (cada uma já filtrada por seq > desde,
 * ordenada por seq e limitada a `limite + 1`) e corta no limite.
 *
 * Registros que o usuário não pode ler chegam só como "excluído" (sem dados),
 * para o aparelho apagar a cópia local. Ex.: o coletor cadastra o telefone do
 * proprietário, mas depois de sincronizar só o gestor fica com esse dado.
 */
export function montarRecebimento(
  porColecao: { colecao: Colecao; registros: Registro[] }[],
  ctx: ContextoUsuario,
  desde: number,
  limite: number,
): RespostaRecebimento {
  const todos: { col: Colecao; reg: Registro }[] = [];
  for (const { colecao, registros } of porColecao) {
    for (const reg of registros) if ((reg.seq ?? 0) > desde) todos.push({ col: colecao, reg });
  }
  todos.sort((a, b) => (a.reg.seq ?? 0) - (b.reg.seq ?? 0));
  const lote = todos.slice(0, limite);
  return {
    registros: lote.map(({ col, reg }) => ({
      colecao: col.nome,
      registro: podeLer(ctx, col, reg) ? reg : { id: reg.id, versao: reg.versao, seq: reg.seq, excluido: true },
    })),
    cursor: lote.length ? (lote[lote.length - 1].reg.seq ?? desde) : desde,
    mais: todos.length > limite,
  };
}
