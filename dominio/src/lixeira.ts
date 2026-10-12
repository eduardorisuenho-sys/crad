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
  lote_mudas: ['movimento_estoque_mudas', 'evento_lote_mudas'],
  doacao: ['doacao_item', 'doacao_programa', 'doacao_programa_historico'],
  plantio: ['plantio_item', 'monitoramento'],
  monitoramento: ['monitoramento_item'],
  especie: ['nome_popular', 'sinonimo', 'especie_ocorrencia', 'especie_municipio', 'especie_opcao', 'especie_foto', 'especie_confusao'],
  pessoa: ['dados_pessoais'],
};

export interface Dependente {
  colecao: string;
  quantidade: number;
}

/** Registros ativos que ainda apontam para este (impedem apagar de vez). */
export function dependentesAtivos(nomeColecao: string, id: string, registrosDe: (colecao: string, campo: string, id: string) => Reg[]): Dependente[] {
  const contagem = new Map<string, number>();
  const junto = new Set(APAGA_JUNTO[nomeColecao] ?? []);
  for (const { colecao, campo } of referenciasPara(nomeColecao)) {
    if (junto.has(colecao.nome)) continue;
    const n = registrosDe(colecao.nome, campo, id).filter((r) => !r.excluido).length;
    if (n) contagem.set(colecao.nome, (contagem.get(colecao.nome) ?? 0) + n);
  }
  return [...contagem].map(([colecao, quantidade]) => ({ colecao, quantidade }));
}

export function mensagemDependentes(d: Dependente[]): string {
  return `Ainda há registros ligados a este: ${d.map((x) => `${x.quantidade} em ${x.colecao.replace(/_/g, ' ')}`).join(', ')}. Exclua ou corrija esses antes.`;
}
