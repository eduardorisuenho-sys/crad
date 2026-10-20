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
  /** viveiro escolhido no app: o trabalho da equipe conta só dele, como nas listas */
  viveiroId?: string;
}

/** Número de pendências por rota do módulo (só as que têm alguma). */
export type Pendencias = Partial<Record<'/matrizes' | '/coleta' | '/viveiro' | '/doacao' | '/pos-plantio' | '/especies' | '/equipe', number>>;

const ativos = (rs: Reg[]) => rs.filter((r) => !r.excluido);
const EM_ANALISE = ['enviada', 'em_analise'];

type Por = <T>(rs: Reg[], campo: string, valor: (r: Reg) => T) => Map<string, T[]>;
const agrupar: Por = (rs, campo, valor) => {
  const m = new Map<string, ReturnType<typeof valor>[]>();
  for (const r of ativos(rs)) m.set(String(r[campo]), [...(m.get(String(r[campo])) ?? []), valor(r)]);
  return m;
};

/** Pedidos de mudas que esperam alguma ação desta pessoa (para marcar na lista). */
export function pedidosQueEsperam(d: Pick<DadosPendencias, 'doacoes' | 'itens' | 'baixas'>, q: QuemVe): Set<string> {
  const doViveiro = (v: unknown) => !q.viveiroId || v === q.viveiroId;
  const itensDoPedido = agrupar(d.itens, 'doacao_id', (i) => i);
  const baixadoNoItem = agrupar(d.baixas, 'doacao_item_id', (b) => Number(b.quantidade ?? 0));
  const saiuAlgo = (doacaoId: string) => (itensDoPedido.get(doacaoId) ?? []).some((i) => Number(i.qtd_entregue ?? 0) > 0 || (baixadoNoItem.get(i.id) ?? []).some((n) => n > 0));
  const ids = new Set<string>();
  for (const x of ativos(d.doacoes)) {
    const situacao = String(x.situacao ?? '');
    const meu = x.solicitante_usuario_id === q.usuarioId;
    const viv = x.viveiro_id;
    const daEquipe = doViveiro(viv);
    const espera =
      // pedido para analisar (quem aprova; não o próprio pedido)
      (EM_ANALISE.includes(situacao) && !meu && daEquipe && q.pode('aprovar_doacao', viv)) ||
      // aprovado, aguardando a retirada (quem vai buscar e quem entrega)
      (SITUACOES_APROVADAS.includes(situacao) && (meu || (daEquipe && q.pode('retirada', viv)))) ||
      // marcado como retirado, mas as mudas ainda não saíram do estoque
      (situacao === 'retirada' && daEquipe && !saiuAlgo(x.id) && q.pode('retirada', viv));
    if (espera) ids.add(x.id);
  }
  return ids;
}

export type Rota = '/matrizes' | '/coleta' | '/viveiro' | '/doacao' | '/pos-plantio' | '/especies' | '/equipe';

/**
 * Cada pendência com uma chave estável ("coleção:id:motivo"). Quando o motivo
 * muda (ex.: o pedido foi aprovado e agora falta a retirada), a chave muda e
 * a pendência volta a contar como nova, mesmo que a anterior já tenha sido vista.
 */
export function itensPendentes(d: DadosPendencias, q: QuemVe): Partial<Record<Rota, string[]>> {
  const p: Partial<Record<Rota, string[]>> = {};
  const doViveiro = (v: unknown) => !q.viveiroId || v === q.viveiroId;
  const por = agrupar;
  const pedidos = new Map(ativos(d.doacoes).map((x) => [x.id, x]));
  p['/doacao'] = [...pedidosQueEsperam(d, q)].map((id) => `doacao:${id}:${String(pedidos.get(id)?.situacao ?? '')}`);

  const comPlantio = new Set(ativos(d.plantios).map((x) => String(x.doacao_id)));
  const comVistoria = new Set(ativos(d.monitoramentos).filter((m) => m.tipo === 'vistoria').map((m) => String(m.plantio_id)));
  p['/pos-plantio'] = [
    // mudas retiradas: falta quem pediu registrar o plantio
    ...ativos(d.doacoes).filter((x) => x.situacao === 'retirada' && x.solicitante_usuario_id === q.usuarioId && !comPlantio.has(x.id)).map((x) => `plantar:${x.id}:plantio`),
    // plantio ainda sem vistoria técnica da equipe
    ...ativos(d.plantios).filter((x) => !comVistoria.has(x.id) && doViveiro(x.viveiro_id) && q.pode('vistoria', x.viveiro_id)).map((x) => `plantio:${x.id}:vistoria`),
  ];

  // matriz sem espécie, ou com a espécie ainda não confirmada (quem confirma)
  p['/matrizes'] = ativos(d.matrizes)
    .filter((m) => m.situacao !== 'morta' && m.situacao !== 'inativa' && (!m.especie_id || m.grau_certeza !== 'certo' || m.situacao_validacao === 'pendente') && doViveiro(m.viveiro_id) && q.pode('validar_matriz', m.viveiro_id))
    .map((m) => `matriz:${m.id}:${m.especie_id ? 'confirmar' : 'identificar'}`);

  // sementes: lote sem o peso das sementes limpas, ou vencido ainda com sementes (testar ou descartar)
  const movsSementes = por(d.movimentosSementes, 'lote_sementes_id', (m) => m as never);
  p['/coleta'] = ativos(d.lotesSementes).flatMap((l) => {
    if (!doViveiro(l.viveiro_id) || !q.pode('lotes_sementes', l.viveiro_id)) return [];
    const movs = movsSementes.get(l.id) ?? [];
    const saldo = saldoSementes(movs);
    const temSementes = saldo.g > 0 || saldo.unid > 0;
    // pesar só faz sentido se ainda há sementes (ou se nada foi registrado no lote)
    if (!Number(l.peso_g) && (temSementes || !movs.length)) return [`lote_sementes:${l.id}:pesar`];
    if (temSementes && situacaoValidade(l.validade as string, d.hoje, 0) === 'vencido') return [`lote_sementes:${l.id}:vencido`];
    return [];
  });

  // viveiro: lote com mudas e atrasado (passou da data prevista sem ficar pronto) e inventário aberto
  const meses = new Map(ativos(d.especies).map((e) => [e.id, Number(e.meses_ate_pronta ?? 0)]));
  const movsMudas = por(d.movimentosMudas, 'lote_mudas_id', (m) => m as never);
  p['/viveiro'] = [
    ...ativos(d.lotesMudas)
      .filter((l) => doViveiro(l.viveiro_id) && q.pode('producao', l.viveiro_id) && l.situacao !== 'encerrado' && saldoMudas(movsMudas.get(l.id) ?? []) > 0 && atrasado(dataPrevistaPronta(l.data_semeadura as string, meses.get(String(l.especie_id))), l.fase_atual as string, d.hoje))
      .map((l) => `lote_mudas:${l.id}:atrasado`),
    ...ativos(d.inventarios).filter((i) => i.situacao === 'aberto' && doViveiro(i.viveiro_id) && q.pode('inventario', i.viveiro_id)).map((i) => `inventario:${i.id}:aberto`),
  ];

  // espécies marcadas para revisar (ex.: nome vindo da Wikipédia)
  p['/especies'] = q.pode('especies') ? ativos(d.especies).filter((e) => e.revisar === true).map((e) => `especie:${e.id}:revisar`) : [];

  // gente pedindo para entrar na equipe
  p['/equipe'] = ativos(d.pedidosAcesso).filter((a) => a.situacao === 'pendente' && doViveiro(a.viveiro_id) && q.pode('equipe', a.viveiro_id)).map((a) => `pedido_acesso:${a.id}:pendente`);

  for (const k of Object.keys(p) as Rota[]) if (!p[k]!.length) delete p[k];
  return p;
}

/** Número de pendências por módulo; `vistas` = chaves que a pessoa já abriu (não contam mais). */
export function pendencias(d: DadosPendencias, q: QuemVe, vistas: Set<string> = new Set()): Pendencias {
  const p: Pendencias = {};
  for (const [rota, chaves] of Object.entries(itensPendentes(d, q)) as [Rota, string[]][]) {
    const n = chaves.filter((c) => !vistas.has(c)).length;
    if (n) p[rota] = n;
  }
  return p;
}
