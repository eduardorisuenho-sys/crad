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
  const nome = (c: string) => c.replace(/_/g, ' ').replace('lote mudas', 'lote de mudas').replace('lote sementes', 'lote de sementes').replace('inventario item', 'item de inventário').replace('doacao item lote', 'entrega de doação').replace('doacao item', 'item de pedido').replace('doacao', 'pedido');
  const exemplos = (x: Dependente) => (x.exemplos?.length && x.exemplos.some((e) => e && !/^[a-z0-9]{15}$/.test(e)) ? `: ${x.exemplos.join(', ')}${x.quantidade > x.exemplos.length ? '…' : ''}` : '');
  return `Ainda há registros ligados a este: ${d.map((x) => `${x.quantidade} em ${nome(x.colecao)}${exemplos(x)}`).join('; ')}. Exclua ou corrija esses antes.`;
}

// ---------------------------------------------------------------- excluir com o que veio dele

/** Cadastros que só existem por causa do registro e vão para a lixeira com ele (a corrente matriz → coleta → lote → mudas). */
const CASCATA = new Set(['coleta', 'lote_sementes_coleta', 'lote_sementes', 'lote_mudas', 'sugestao_identificacao']);
/** Histórico (pesagens, semeadura, flor e fruto, perdas, contagens): fica escondido junto com o lote ou a matriz. */
const HISTORICO_JUNTO = new Set(['fenologia', 'movimento_sementes', 'movimento_estoque_mudas', 'evento_lote_mudas', 'inventario_item']);
/** Ordem de excluir: primeiro o que veio depois (mudas), por último o registro escolhido. */
const ORDEM_CASCATA = ['sugestao_identificacao', 'lote_mudas', 'lote_sementes_coleta', 'lote_sementes', 'coleta', 'matriz'];

export interface PlanoExclusao {
  /** tudo que vai para a lixeira, na ordem de excluir (o registro escolhido por último) */
  apagar: { colecao: string; id: string; rotulo: string; viveiro_id?: unknown }[];
  /** o que impede (mudas reservadas ou já doadas, lote com sementes de outra matriz…) */
  bloqueios: Dependente[];
}

/**
 * Excluir um cadastro com o que foi feito a partir dele (ex.: a matriz, as coletas dela,
 * o lote de sementes de cada coleta e as mudas desse lote). Bloqueia o que não pode sumir
 * sem aviso: mudas reservadas para um pedido aprovado, mudas já entregues numa doação,
 * plantios, e lote de sementes que também tem sementes de outra coleta.
 */
export function planoExclusao(
  nomeColecao: string,
  id: string,
  registrosDe: (colecao: string, campo: string, id: string) => Reg[],
  obter: (colecao: string, id: string) => Reg | undefined,
): PlanoExclusao {
  const vistos = new Map<string, { colecao: string; reg: Reg }>();
  const chave = (c: string, i: string) => `${c}:${i}`;
  const bloqueios = new Map<string, Reg[]>();
  const bloquear = (c: string, r: Reg) => bloqueios.set(c, [...(bloqueios.get(c) ?? []), r]);
  const fila: { colecao: string; reg: Reg }[] = [];
  const entrar = (colecao: string, reg: Reg | undefined) => {
    if (!reg || reg.excluido || vistos.has(chave(colecao, reg.id))) return;
    vistos.set(chave(colecao, reg.id), { colecao, reg });
    fila.push({ colecao, reg });
  };
  entrar(nomeColecao, obter(nomeColecao, id) ?? { id });
  while (fila.length) {
    const { colecao, reg } = fila.shift()!;
    const junto = new Set(APAGA_JUNTO[colecao] ?? []);
    for (const { colecao: c, campo } of referenciasPara(colecao)) {
      const sempre = SEMPRE_BLOQUEIA[c.nome];
      for (const r of registrosDe(c.nome, campo, reg.id).filter((x) => !x.excluido)) {
        if (sempre?.(r)) bloquear(c.nome, r);
        else if (CASCATA.has(c.nome)) {
          entrar(c.nome, r);
          // a coleta chega ao lote de sementes pelo vínculo coleta–lote
          if (c.nome === 'lote_sementes_coleta') entrar('lote_sementes', obter('lote_sementes', String(r.lote_sementes_id)));
        } else if (junto.has(c.nome) || HISTORICO_JUNTO.has(c.nome)) continue;
        else bloquear(c.nome, r);
      }
    }
  }
  // lote de sementes com sementes de outra coleta (que não vai junto): não some sem aviso
  for (const { colecao, reg } of vistos.values()) {
    // (excluir o próprio lote leva os vínculos dele; só o lote que veio de uma coleta é conferido)
    if (colecao !== 'lote_sementes' || (colecao === nomeColecao && reg.id === id)) continue;
    const outras = registrosDe('lote_sementes_coleta', 'lote_sementes_id', reg.id).filter((v) => !v.excluido && !vistos.has(chave('coleta', String(v.coleta_id))));
    if (outras.length) bloquear('lote_sementes', reg);
  }
  const ordem = (c: string) => (c === nomeColecao ? 99 : ORDEM_CASCATA.indexOf(c) < 0 ? 0 : ORDEM_CASCATA.indexOf(c));
  return {
    apagar: [...vistos.values()].sort((a, b) => ordem(a.colecao) - ordem(b.colecao)).map(({ colecao, reg }) => ({ colecao, id: reg.id, rotulo: rotuloRegistro(colecao, reg), viveiro_id: reg.viveiro_id })),
    bloqueios: [...bloqueios].map(([colecao, regs]) => ({ colecao, quantidade: regs.length, exemplos: regs.slice(0, 3).map((r) => rotuloRegistro(colecao, r)) })),
  };
}

/** "1 coleta, 1 lote de sementes e 2 lotes de mudas" (o que vai junto com o registro escolhido). */
export function resumoExclusao(plano: PlanoExclusao, nomeColecao: string, id: string): string {
  const nomes: Record<string, [string, string]> = {
    coleta: ['coleta', 'coletas'],
    lote_sementes: ['lote de sementes', 'lotes de sementes'],
    lote_mudas: ['lote de mudas', 'lotes de mudas'],
    sugestao_identificacao: ['sugestão de identificação', 'sugestões de identificação'],
  };
  const conta = new Map<string, string[]>();
  for (const a of plano.apagar) {
    if ((a.colecao === nomeColecao && a.id === id) || !nomes[a.colecao]) continue;
    conta.set(a.colecao, [...(conta.get(a.colecao) ?? []), a.rotulo]);
  }
  const partes = [...conta].map(([c, rotulos]) => `${rotulos.length} ${nomes[c][rotulos.length === 1 ? 0 : 1]} (${rotulos.slice(0, 3).join(', ')}${rotulos.length > 3 ? '…' : ''})`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : (partes[0] ?? '');
}
