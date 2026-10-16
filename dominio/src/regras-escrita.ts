/**
 * Regras de negócio aplicadas a toda gravação que vem dos aparelhos
 * (além das permissões por perfil). Algumas mudanças só o servidor faz:
 * aprovar pedido, criar reserva, expirar prazo.
 */
import { perfisPara, type ContextoUsuario } from './acesso';
import type { Colecao } from './esquema';
import { temPermissao } from './permissoes';

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
  // Permissões por funcionalidade que não dependem só da coleção.
  if (col.nome === 'matriz' && mudou(antes, depois, 'situacao_validacao') && !(antes === null && depois.situacao_validacao === 'pendente')) {
    if (!temPermissao(ctx, 'validar_matriz', depois.viveiro_id)) return 'Você não tem permissão para aprovar matrizes.';
  }
  if (col.nome === 'monitoramento' && depois.tipo === 'vistoria' && mudou(antes, depois, 'tipo')) {
    if (!temPermissao(ctx, 'vistoria', depois.viveiro_id)) return 'Você não tem permissão para registrar vistoria.';
  }
  if (col.nome === 'lote_mudas') {
    if (!antes && depois.origem === 'estoque_inicial') {
      if (!temPermissao(ctx, 'estoque_inicial', depois.viveiro_id)) return 'Você não tem permissão para cadastrar mudas que já estavam no viveiro.';
    } else {
      // Semear, cuidar e mudar o lote é da produção (o estoque inicial só cadastra).
      if (!temPermissao(ctx, 'producao', depois.viveiro_id)) return 'Você não tem permissão para semear e cuidar das mudas.';
      if (!antes && !depois.lote_sementes_id) return 'Informe o lote de sementes da semeadura.';
    }
  }
  if (col.nome === 'coleta' && !depois.matriz_id && !depois.especie_id) return 'Informe a matriz ou, se a árvore não tem matriz cadastrada, a espécie.';
  if (col.nome === 'movimento_estoque_mudas') {
    // Cada movimento pede a permissão da tarefa que o gera.
    const tarefa = !antes && depois.tipo === 'entrada' && depois.referencia === 'estoque inicial' ? 'estoque_inicial' : depois.tipo === 'saida_doacao' ? 'retirada' : depois.tipo === 'ajuste_inventario' ? 'inventario' : 'producao';
    if (!temPermissao(ctx, tarefa, depois.viveiro_id) && !temPermissao(ctx, 'producao', depois.viveiro_id)) return 'Você não tem permissão para este movimento de mudas.';
  }
  if (col.nome === 'usuario_viveiro' && !ctx.gestorGeral) {
    // Igual às rotas da equipe: só um gestor do viveiro dá ou tira o perfil de gestor.
    const envolveGestor = depois.perfil === 'gestor' || antes?.perfil === 'gestor';
    if (envolveGestor && !(ctx.perfisPorViveiro[String(depois.viveiro_id)] ?? []).includes('gestor')) return 'Só um gestor pode cadastrar ou tirar outro gestor.';
    if (depois.usuario_id === ctx.id && (mudou(antes, depois, 'perfil') || !antes)) return 'Ninguém muda o próprio perfil.';
  }
  if (col.nome === 'parametro' && (depois.chave === 'permissoes' || antes?.chave === 'permissoes') && !ctx.gestorGeral) {
    return 'Só o administrador muda a tabela de permissões.';
  }
  if (col.nome === 'parametro' && (depois.chave === 'termo_compromisso' || antes?.chave === 'termo_compromisso') && !ctx.gestorGeral) {
    return 'Só o administrador muda o termo de compromisso.';
  }
  if (col.nome === 'doacao') {
    // quem pede mudas pelo app precisa aceitar o termo de compromisso
    if (!antes && soSolicitante(ctx, depois) && (!depois.termo_aceito_em || !String(depois.termo_texto ?? '').trim())) {
      return 'Para pedir mudas é preciso ler e aceitar o termo de compromisso e declaração.';
    }
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
