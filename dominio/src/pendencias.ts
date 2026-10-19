/**
 * Pendências: o que espera alguma ação da pessoa para o processo continuar.
 * Vira o número pequeno no canto do botão do módulo, na tela inicial.
 * Cada pedido conta uma vez só, mesmo se tiver mais de um motivo.
 */
import { SITUACOES_APROVADAS } from './doacao';
import { saldoSementes, situacaoValidade } from './sementes';
import { atrasado, dataPrevistaPronta, saldoMudas } from './viveiro';

type Reg = Record<string, unknown> & { id: string; excluido?: boolean };

export interface DadosPendencias {
  doacoes: Reg[];
  itens: Reg[];
  /** doacao_item_lote: mudas que já saíram do estoque na retirada */
  baixas: Reg[];
  plantios: Reg[];
  matrizes: Reg[];
  especies: Reg[];
  pedidosAcesso: Reg[];
  lotesSementes: Reg[];
  movimentosSementes: Reg[];
  lotesMudas: Reg[];
  movimentosMudas: Reg[];
  inventarios: Reg[];
  monitoramentos: Reg[];
  /** hoje (AAAA-MM-DD) */
  hoje: string;
}

export interface QuemVe {
  usuarioId: string;
  /** a pessoa tem esta permissão neste viveiro? */
  pode: (chave: string, viveiroId?: unknown) => boolean;
}

/** Número de pendências por rota do módulo (só as que têm alguma). */
export type Pendencias = Partial<Record<'/matrizes' | '/coleta' | '/viveiro' | '/doacao' | '/pos-plantio' | '/especies' | '/equipe', number>>;

const ativos = (rs: Reg[]) => rs.filter((r) => !r.excluido);
const EM_ANALISE = ['enviada', 'em_analise'];

export function pendencias(d: DadosPendencias, q: QuemVe): Pendencias {
  const p: Pendencias = {};
  const por = <T>(rs: Reg[], campo: string, valor: (r: Reg) => T) => {
    const m = new Map<string, T[]>();
    for (const r of ativos(rs)) m.set(String(r[campo]), [...(m.get(String(r[campo])) ?? []), valor(r)]);
    return m;
  };
  const itensDoPedido = por(d.itens, 'doacao_id', (i) => i);
  const baixadoNoItem = por(d.baixas, 'doacao_item_id', (b) => Number(b.quantidade ?? 0));
  const saiuAlgo = (doacaoId: string) => (itensDoPedido.get(doacaoId) ?? []).some((i) => Number(i.qtd_entregue ?? 0) > 0 || (baixadoNoItem.get(i.id) ?? []).some((q) => q > 0));
  const comPlantio = new Set(ativos(d.plantios).map((x) => String(x.doacao_id)));

  let doacao = 0;
  let posPlantio = 0;
  for (const x of ativos(d.doacoes)) {
    const situacao = String(x.situacao ?? '');
    const meu = x.solicitante_usuario_id === q.usuarioId;
    const viv = x.viveiro_id;
    const espera =
      // pedido para analisar (quem aprova; não o próprio pedido)
      (EM_ANALISE.includes(situacao) && !meu && q.pode('aprovar_doacao', viv)) ||
      // aprovado, aguardando a retirada (quem entrega e quem vai buscar)
      (SITUACOES_APROVADAS.includes(situacao) && (meu || q.pode('retirada', viv))) ||
      // marcado como retirado, mas as mudas ainda não saíram do estoque
      (situacao === 'retirada' && !saiuAlgo(x.id) && q.pode('retirada', viv));
    if (espera) doacao++;
    // mudas retiradas: falta registrar o plantio
    if (situacao === 'retirada' && meu && !comPlantio.has(x.id)) posPlantio++;
  }
  // plantio ainda sem vistoria técnica da equipe
  const comVistoria = new Set(ativos(d.monitoramentos).filter((m) => m.tipo === 'vistoria').map((m) => String(m.plantio_id)));
  posPlantio += ativos(d.plantios).filter((x) => !comVistoria.has(x.id) && q.pode('vistoria', x.viveiro_id)).length;
  if (doacao) p['/doacao'] = doacao;
  if (posPlantio) p['/pos-plantio'] = posPlantio;

  // matriz sem espécie, ou com a espécie ainda não confirmada (quem confirma)
  const matrizes = ativos(d.matrizes).filter((m) => m.situacao !== 'morta' && m.situacao !== 'inativa' && (!m.especie_id || m.grau_certeza !== 'certo' || m.situacao_validacao === 'pendente') && q.pode('validar_matriz', m.viveiro_id)).length;
  if (matrizes) p['/matrizes'] = matrizes;

  // sementes: lote sem o peso das sementes limpas, ou vencido ainda com sementes (testar ou descartar)
  const movsSementes = por(d.movimentosSementes, 'lote_sementes_id', (m) => m as never);
  const sementes = ativos(d.lotesSementes).filter((l) => {
    if (!q.pode('lotes_sementes', l.viveiro_id)) return false;
    const saldo = saldoSementes(movsSementes.get(l.id) ?? []);
    const temSementes = saldo.g > 0 || saldo.unid > 0;
    return !Number(l.peso_g) || (temSementes && situacaoValidade(l.validade as string, d.hoje, 0) === 'vencido');
  }).length;
  if (sementes) p['/coleta'] = sementes;

  // viveiro: lote com mudas e atrasado (passou da data prevista sem ficar pronto) e inventário aberto
  const meses = new Map(ativos(d.especies).map((e) => [e.id, Number(e.meses_ate_pronta ?? 0)]));
  const movsMudas = por(d.movimentosMudas, 'lote_mudas_id', (m) => m as never);
  const viveiro =
    ativos(d.lotesMudas).filter((l) => q.pode('producao', l.viveiro_id) && l.situacao !== 'encerrado' && saldoMudas(movsMudas.get(l.id) ?? []) > 0 && atrasado(dataPrevistaPronta(l.data_semeadura as string, meses.get(String(l.especie_id))), l.fase_atual as string, d.hoje)).length +
    ativos(d.inventarios).filter((i) => i.situacao === 'aberto' && q.pode('inventario', i.viveiro_id)).length;
  if (viveiro) p['/viveiro'] = viveiro;

  // espécies marcadas para revisar (ex.: nome vindo da Wikipédia)
  const especies = q.pode('especies') ? ativos(d.especies).filter((e) => e.revisar === true).length : 0;
  if (especies) p['/especies'] = especies;

  // gente pedindo para entrar na equipe
  const acessos = ativos(d.pedidosAcesso).filter((a) => a.situacao === 'pendente' && q.pode('equipe', a.viveiro_id)).length;
  if (acessos) p['/equipe'] = acessos;
  return p;
}
