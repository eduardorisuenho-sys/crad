/**
 * Notificações: quando chega do servidor uma novidade que interessa à pessoa
 * (pedido de mudas novo, aprovação, retirada combinada, matriz validada…),
 * o app toca um som e mostra um aviso. Aqui só a regra de quem é avisado do quê.
 */
import type { ContextoUsuario } from './acesso';
import { temPermissao } from './permissoes';

type Reg = Record<string, unknown>;

export interface Notificacao {
  titulo: string;
  texto: string;
  /** tela que abre ao tocar no aviso */
  rota: string;
}

const EM_ANALISE = ['enviada', 'em_analise'];
const APROVADA = ['aprovada', 'aprovada_parcial'];
const dia = (v: unknown) => String(v ?? '').slice(0, 10).split('-').reverse().join('/');
const mudou = (antes: Reg | undefined, depois: Reg, campo: string) => (antes ? antes[campo] : undefined) !== depois[campo];

/** Notificação para a pessoa, ou null. `antes` é o que o aparelho tinha (undefined = registro novo). */
export function notificacaoPara(colecao: string, antes: Reg | undefined, depois: Reg, ctx: ContextoUsuario): Notificacao | null {
  if (depois.excluido && colecao !== 'matriz') return null;
  // O que a própria pessoa fez não vira aviso para ela.
  if (depois.atualizado_por === ctx.id || (!antes && depois.criado_por === ctx.id)) return null;
  const id = String(depois.id ?? '');
  const codigo = String(depois.codigo ?? '');

  if (colecao === 'doacao') {
    const meu = depois.solicitante_usuario_id === ctx.id;
    const rota = `/doacao/${id}`;
    if (EM_ANALISE.includes(String(depois.situacao)) && (!antes || !EM_ANALISE.includes(String(antes.situacao))) && !meu && temPermissao(ctx, 'aprovar_doacao', depois.viveiro_id)) {
      return { titulo: 'Novo pedido de mudas', texto: `O pedido ${codigo} está aguardando análise.`, rota };
    }
    if (mudou(antes, depois, 'situacao') && APROVADA.includes(String(depois.situacao))) {
      if (meu) return { titulo: 'Seu pedido de mudas foi aprovado!', texto: `Pedido ${codigo}: fale com o viveiro para combinar o dia da retirada.`, rota };
      if (temPermissao(ctx, 'retirada', depois.viveiro_id)) return { titulo: 'Pedido aprovado', texto: `O pedido ${codigo} foi aprovado: combine a retirada com quem pediu.`, rota };
    }
    if (meu && mudou(antes, depois, 'situacao') && depois.situacao === 'negada') {
      return { titulo: 'Seu pedido de mudas não foi aprovado', texto: `Pedido ${codigo}. Veja o motivo no pedido.`, rota };
    }
    if (meu && depois.retirada_combinada && mudou(antes, depois, 'retirada_combinada')) {
      return { titulo: 'Retirada combinada', texto: `Busque as mudas do pedido ${codigo} em ${dia(depois.retirada_combinada)}.`, rota };
    }
    return null;
  }

  if (colecao === 'pedido_acesso' && !antes && depois.situacao === 'pendente' && temPermissao(ctx, 'equipe', depois.viveiro_id)) {
    return { titulo: 'Novo pedido de acesso', texto: `${String(depois.nome ?? 'Alguém')} quer entrar na equipe como ${String(depois.perfil ?? '')}.`, rota: '/equipe' };
  }

  if (colecao === 'matriz') {
    const rota = `/matrizes/${id}`;
    if (depois.criado_por === ctx.id && mudou(antes, depois, 'situacao_validacao')) {
      if (depois.situacao_validacao === 'aprovada') return { titulo: 'Matriz aprovada', texto: `A matriz ${codigo} foi aprovada pelo gestor.`, rota };
      if (depois.situacao_validacao === 'reprovada') return { titulo: 'Matriz reprovada', texto: `A matriz ${codigo} não foi aprovada pelo gestor.`, rota: '/matrizes' };
    }
    if (!antes && !depois.excluido && (depois.situacao_validacao ?? 'pendente') === 'pendente' && temPermissao(ctx, 'validar_matriz', depois.viveiro_id)) {
      return { titulo: 'Nova matriz para validar', texto: `A matriz ${codigo} está aguardando sua validação.`, rota };
    }
  }
  return null;
}
