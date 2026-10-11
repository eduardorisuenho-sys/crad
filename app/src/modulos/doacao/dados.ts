/** Consultas do Módulo 5 (doação) no aparelho. */
import { disponivelPorLote, marcadaNoPrograma, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';
import type { Repositorio } from '../../dados/repositorio';
import { lerCatalogo } from '../catalogo/api';

export const PROGRAMA_PLANTANDO_AGUA = 'plantandoagua01';

export const ROTULO_SITUACAO: Record<string, string> = {
  rascunho: 'rascunho',
  enviada: 'aguardando análise',
  em_analise: 'em análise',
  aprovada: 'aprovado',
  aprovada_parcial: 'aprovado em parte',
  negada: 'recusado',
  aguardando_retirada: 'aguardando retirada',
  retirada: 'retirado',
  expirada: 'prazo vencido',
  cancelada: 'cancelado',
};

export const FINALIDADES = ['Beira de rio ou nascente', 'Recuperar área degradada', 'Reserva legal', 'Arborização urbana', 'Escola ou quintal', 'Sistema agroflorestal', 'Outra'];

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);

/** Mudas disponíveis por espécie num viveiro, calculadas com o estoque do aparelho (equipe). */
export async function disponivelLocal(db: BancoCrads, viveiroId: string): Promise<Map<string, number>> {
  const doViveiro = async (n: string) => ativos(await db.colecao(n).where('viveiro_id').equals(viveiroId).toArray());
  const lotes = await doViveiro('lote_mudas');
  const disp = disponivelPorLote({ lotesMudas: lotes, movimentos: await doViveiro('movimento_estoque_mudas'), reservas: await doViveiro('reserva') });
  const m = new Map<string, number>();
  for (const l of lotes) if (disp.has(l.id)) m.set(String(l.especie_id), (m.get(String(l.especie_id)) ?? 0) + (disp.get(l.id) ?? 0));
  return m;
}

/** Para o solicitante: o disponível vem do catálogo público (guardado para usar sem internet). */
export async function disponivelPublico(servidor: string): Promise<{ viveiros: { id: string; nome: string }[]; porViveiro: Map<string, Map<string, number>>; nomes: Map<string, string> }> {
  const r = await lerCatalogo(servidor);
  const porViveiro = new Map<string, Map<string, number>>();
  const viveiros = new Map<string, string>();
  const nomes = new Map<string, string>();
  for (const i of r.dados.itens) {
    nomes.set(i.especie_id, i.nomes_populares[0] ?? i.nome_cientifico);
    for (const v of i.por_viveiro) {
      viveiros.set(v.viveiro_id, v.viveiro);
      (porViveiro.get(v.viveiro_id) ?? porViveiro.set(v.viveiro_id, new Map()).get(v.viveiro_id)!).set(i.especie_id, v.disponivel);
    }
  }
  return { viveiros: [...viveiros.entries()].map(([id, nome]) => ({ id, nome })), porViveiro, nomes };
}

export async function itensDoPedido(db: BancoCrads, doacaoId: string): Promise<Registro[]> {
  return ativos(await db.colecao('doacao_item').where('doacao_id').equals(doacaoId).toArray());
}

/** Doações marcadas no Plantando Água (vale a última ação do histórico). */
export async function doacoesNoPrograma(db: BancoCrads, programaId = PROGRAMA_PLANTANDO_AGUA): Promise<Set<string>> {
  const hist = ativos(await db.colecao('doacao_programa_historico').toArray());
  return new Set([...new Set(hist.map((h) => String(h.doacao_id)))].filter((d) => marcadaNoPrograma(hist as never, d, programaId)));
}

/** Marca ou desmarca a doação no programa: atualiza a marcação e grava o histórico (quem e quando). */
export async function marcarPrograma(db: BancoCrads, repo: Repositorio, doacao: Registro, marcar: boolean, usuarioNome: string, motivo = '', programaId = PROGRAMA_PLANTANDO_AGUA) {
  const atual = ativos(await db.colecao('doacao_programa').where('doacao_id').equals(doacao.id).toArray()).find((m) => m.programa_id === programaId);
  const base = { doacao_id: doacao.id, programa_id: programaId, viveiro_id: doacao.viveiro_id };
  if (atual) await repo.salvar('doacao_programa', { ativo: marcar }, atual.id);
  else await repo.salvar('doacao_programa', { ...base, ativo: marcar });
  await repo.salvar('doacao_programa_historico', { ...base, acao: marcar ? 'marcou' : 'desmarcou', motivo: motivo || null, usuario_nome: usuarioNome });
}
