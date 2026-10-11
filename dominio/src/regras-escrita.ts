/**
 * Regras de negócio aplicadas a toda gravação que vem dos aparelhos
 * (além das permissões por perfil). Algumas mudanças só o servidor faz:
 * aprovar pedido, criar reserva, expirar prazo.
 */
import { perfisPara, type ContextoUsuario } from './acesso';
import type { Colecao } from './esquema';

type Reg = Record<string, unknown>;

/** Situações da doação que só o servidor define (análise e prazo). */
export const SITUACOES_SO_SERVIDOR = ['aprovada', 'aprovada_parcial', 'negada', 'expirada'];
const CAMPOS_ANALISE = ['analisado_por', 'analisado_em', 'justificativa', 'retirar_ate'];

const mudou = (antes: Reg | null, depois: Reg, campo: string) => (antes ? antes[campo] : undefined) !== depois[campo] && !(antes === null && (depois[campo] === undefined || depois[campo] === null || depois[campo] === ''));

function soSolicitante(ctx: ContextoUsuario, reg: Reg): boolean {
  const p = perfisPara(ctx, reg.viveiro_id);
  return p.has('solicitante') && !p.has('viveirista') && !p.has('gestor') && !p.has('coletor');
}

/** Devolve o motivo da recusa, ou null se a gravação pode seguir. */
export function violacaoRegra(col: Colecao, antes: Reg | null, depois: Reg, ctx: ContextoUsuario): string | null {
  if (col.nome === 'doacao') {
    if (mudou(antes, depois, 'situacao') && SITUACOES_SO_SERVIDOR.includes(String(depois.situacao))) {
      return 'A aprovação do pedido é feita com internet, para reservar as mudas no servidor.';
    }
    if (soSolicitante(ctx, depois)) {
      if (CAMPOS_ANALISE.some((c) => mudou(antes, depois, c))) return 'O solicitante não altera a análise do pedido.';
      if (mudou(antes, depois, 'situacao') && !['rascunho', 'enviada', 'cancelada'].includes(String(depois.situacao))) return 'O solicitante só envia ou cancela o pedido.';
      if (antes && !['rascunho', 'enviada'].includes(String(antes.situacao)) && depois.situacao !== 'cancelada') return 'O pedido já foi analisado e não pode ser mudado pelo solicitante.';
    }
    if (antes && mudou(antes, depois, 'situacao') && depois.situacao === 'retirada' && !['aprovada', 'aprovada_parcial'].includes(String(antes.situacao))) {
      return 'Só pedidos aprovados podem ser retirados.';
    }
  }
  if (col.nome === 'doacao_item') {
    if (mudou(antes, depois, 'qtd_aprovada')) return 'A quantidade aprovada é definida na análise do pedido (com internet).';
    if (soSolicitante(ctx, depois) && mudou(antes, depois, 'qtd_entregue')) return 'A entrega é registrada pelo viveiro.';
  }
  if (col.nome === 'reserva') {
    if (!antes) return 'Reservas são criadas pelo servidor ao aprovar o pedido.';
    if (mudou(antes, depois, 'quantidade') || mudou(antes, depois, 'lote_mudas_id')) return 'A reserva não pode ser alterada.';
    if (mudou(antes, depois, 'situacao') && !(antes.situacao === 'ativa' && ['consumida', 'cancelada'].includes(String(depois.situacao)))) {
      return 'A reserva só pode ser consumida (retirada) ou cancelada.';
    }
  }
  return null;
}
