/**
 * Lixeira: excluir manda o registro para a lixeira (some de todos os aparelhos,
 * mas pode voltar). Só o administrador apaga de vez, e só se nada ativo
 * depender dele. A auditoria guarda quem apagou, quando e o código.
 */
import { COLECOES, type Colecao } from './esquema';

type Reg = Record<string, unknown> & { id: string };

/** Coleções que o administrador corrige pela tela da lixeira, com o rótulo usado na tela. */
export const COLECOES_LIXEIRA: { nome: string; rotulo: string }[] = [
  { nome: 'matriz', rotulo: 'Matrizes' },
  { nome: 'coleta', rotulo: 'Coletas' },
  { nome: 'lote_sementes', rotulo: 'Lotes de sementes' },
  { nome: 'lote_mudas', rotulo: 'Lotes de mudas' },
  { nome: 'doacao', rotulo: 'Pedidos de doação' },
  { nome: 'plantio', rotulo: 'Plantios' },
  { nome: 'monitoramento', rotulo: 'Acompanhamentos' },
  { nome: 'especie', rotulo: 'Espécies' },
  { nome: 'pessoa', rotulo: 'Pessoas (solicitantes, proprietários)' },
  { nome: 'viveiro', rotulo: 'Viveiros' },
];

/** Onde outras coleções apontam para esta (campos de referência). */
export function referenciasPara(nomeColecao: string): { colecao: Colecao; campo: string }[] {
  const out: { colecao: Colecao; campo: string }[] = [];
  for (const c of COLECOES) for (const f of c.campos) if (f.tipo === 'ref' && f.ref === nomeColecao) out.push({ colecao: c, campo: f.nome });
  // O viveiro_id das coleções por viveiro é implícito (não está nos campos).
  if (nomeColecao === 'viveiro') for (const c of COLECOES) if (c.porViveiro && !out.some((x) => x.colecao === c && x.campo === 'viveiro_id')) out.push({ colecao: c, campo: 'viveiro_id' });
  return out;
}

/** Texto curto para mostrar o registro na lista (sem dados pessoais além do nome). */
export function rotuloRegistro(colecao: string, r: Reg): string {
  const dia = (v: unknown) => String(v ?? '').slice(0, 10).split('-').reverse().join('/');
  switch (colecao) {
    case 'especie':
      return String(r.nome_cientifico ?? r.id);
    case 'pessoa':
    case 'viveiro':
      return String(r.nome ?? r.id);
    case 'retirada':
      return `Retirada de ${dia(r.data ?? r.criado_no_aparelho_em)}`;
    case 'coleta':
    case 'fenologia':
    case 'plantio':
    case 'monitoramento':
      return `${colecao === 'monitoramento' ? 'Acompanhamento' : colecao === 'plantio' ? 'Plantio' : colecao === 'fenologia' ? 'Flor e fruto' : 'Coleta'} de ${dia(r.data ?? r.criado_no_aparelho_em)}`;
    default:
      return String(r.codigo ?? r.id);
  }
}

/**
 * O que vai junto quando se apaga de vez (detalhes que só existem por causa do
 * registro). As fotos ligadas pelo registro_id também vão. O resto bloqueia.
 */
export const APAGA_JUNTO: Record<string, string[]> = {
  matriz: ['fenologia'],
  lote_sementes: ['lote_sementes_coleta', 'movimento_sementes'],
  lote_mudas: ['movimento_estoque_mudas', 'evento_lote_mudas', 'inventario_item', 'reserva'],
  doacao: ['doacao_item', 'doacao_programa', 'doacao_programa_historico', 'retirada'],
  doacao_item: ['reserva', 'doacao_item_lote'],
  plantio: ['plantio_item', 'monitoramento'],
  monitoramento: ['monitoramento_item'],
  especie: ['nome_popular', 'sinonimo', 'especie_ocorrencia', 'especie_municipio', 'especie_opcao', 'especie_foto', 'especie_confusao'],
  pessoa: ['dados_pessoais'],
};

export interface Dependente {
  colecao: string;
  quantidade: number;
  /** quais são (código ou nome), para a pessoa achar e resolver */
  exemplos?: string[];
}

/** Ligados que bloqueiam mesmo indo junto: reserva ativa segura mudas de um pedido aprovado. */
const SEMPRE_BLOQUEIA: Record<string, (r: Reg) => boolean> = {
  reserva: (r) => r.situacao === 'ativa',
};

/**
 * Ordem para apagar vários de uma vez: primeiro o que aponta para os outros
 * (pedidos, plantios), depois lotes, coletas, matrizes e por fim espécies e pessoas.
 */
export const ORDEM_APAGAR = ['monitoramento', 'plantio', 'doacao', 'retirada', 'lote_mudas', 'lote_sementes', 'coleta', 'matriz', 'especie', 'pessoa', 'viveiro'];
export function ordemParaApagar(colecao: string): number {
  const i = ORDEM_APAGAR.indexOf(colecao);
  return i < 0 ? ORDEM_APAGAR.indexOf('lote_mudas') : i;
}

/** Registros ativos que ainda apontam para este (impedem apagar de vez). */
export function dependentesAtivos(nomeColecao: string, id: string, registrosDe: (colecao: string, campo: string, id: string) => Reg[]): Dependente[] {
  const contagem = new Map<string, Reg[]>();
  const junto = new Set(APAGA_JUNTO[nomeColecao] ?? []);
  for (const { colecao, campo } of referenciasPara(nomeColecao)) {
    const sempre = SEMPRE_BLOQUEIA[colecao.nome];
    if (junto.has(colecao.nome) && !sempre) continue;
    // reserva já usada ou cancelada não segura nada: só a ativa bloqueia
    const ativos = registrosDe(colecao.nome, campo, id).filter((r) => !r.excluido && (!sempre || sempre(r)));
    if (ativos.length) contagem.set(colecao.nome, [...(contagem.get(colecao.nome) ?? []), ...ativos]);
  }
  return [...contagem].map(([colecao, regs]) => ({ colecao, quantidade: regs.length, exemplos: regs.slice(0, 3).map((r) => rotuloRegistro(colecao, r)) }));
}

export function mensagemDependentes(d: Dependente[]): string {
  const nome = (c: string) => c.replace(/_/g, ' ').replace('lote mudas', 'lote de mudas').replace('lote sementes', 'lote de sementes').replace('inventario item', 'item de inventário').replace('doacao item', 'item de pedido').replace('doacao', 'pedido');
  const exemplos = (x: Dependente) => (x.exemplos?.length && x.exemplos.some((e) => e && !/^[a-z0-9]{15}$/.test(e)) ? `: ${x.exemplos.join(', ')}${x.quantidade > x.exemplos.length ? '…' : ''}` : '');
  return `Ainda há registros ligados a este: ${d.map((x) => `${x.quantidade} em ${nome(x.colecao)}${exemplos(x)}`).join('; ')}. Exclua ou corrija esses antes.`;
}
