/**
 * Decide o que fazer com uma operação vinda do aparelho.
 *
 * É uma função pura: o servidor (hook do PocketBase) e o servidor falso dos
 * testes usam exatamente esta lógica, e só cuidam de ler e gravar.
 */
import { escreveComoSolicitante, podeEscrever, type ContextoUsuario } from '../acesso';
import { ehProvisorio, type FaixaCodigo } from '../codigos';
import { violacaoRegra } from '../regras-escrita';
import { existeColecao, colecao as buscarColecao, type Campo, type Colecao } from '../esquema';
import type { ConflitoCampo, Operacao, Registro, ResultadoOperacao } from './tipos';
import { iguais } from './valores';

/** O que o resolvedor precisa saber do banco do servidor. */
export interface PortaServidor {
  /** já existe outro registro da coleção com este código? */
  codigoEmUso(colecao: string, codigo: string, excetoId: string): boolean;
  /** gera um código definitivo novo para o registro (provisório ou repetido) */
  novoCodigo(col: Colecao, registro: Registro): string;
  /** faixas de código reservadas para o aparelho */
  faixasDoDispositivo(dispositivoId: string): FaixaCodigo[];
}

export interface Auditoria {
  acao: 'criar' | 'alterar' | 'excluir';
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown>;
}

export interface Decisao {
  /** registro a gravar no servidor; null = nada muda */
  gravar: Registro | null;
  resultado: ResultadoOperacao;
  auditoria: Auditoria | null;
  /** conflitos a registrar para revisão do gestor */
  conflitos: ConflitoCampo[];
}

function resultado(op: Operacao, status: ResultadoOperacao['status'], extra: Partial<ResultadoOperacao> = {}): ResultadoOperacao {
  return { op_id: op.op_id, colecao: op.colecao, registro_id: op.registro_id, status, ...extra };
}

function rejeitar(op: Operacao, motivo: string, atual?: Registro | null): Decisao {
  return { gravar: null, resultado: resultado(op, 'rejeitada', { motivo, registro: atual ?? undefined }), auditoria: null, conflitos: [] };
}

function valorValido(c: Campo, v: unknown): boolean {
  if (v === null || v === undefined) return true;
  switch (c.tipo) {
    case 'texto':
    case 'data':
    case 'ref':
      return typeof v === 'string';
    case 'numero':
      return typeof v === 'number' && Number.isFinite(v);
    case 'bool':
      return typeof v === 'boolean';
    case 'opcao':
      if (c.multiplo) return Array.isArray(v) && v.every((x) => c.opcoes!.includes(x as string));
      return v === '' || c.opcoes!.includes(v as string);
    case 'json':
      return true;
    case 'arquivo':
      return false; // arquivos vão pela fila de arquivos, não pela operação
  }
}

/** Mantém só os campos conhecidos e de valor válido. */
export function limparDados(col: Colecao, dados: Record<string, unknown>): { limpos: Record<string, unknown>; erros: string[] } {
  const permitidos = new Map<string, Campo>(col.campos.map((c) => [c.nome, c]));
  if (col.porViveiro) permitidos.set('viveiro_id', { nome: 'viveiro_id', tipo: 'ref', ref: 'viveiro', obrigatorio: true });
  const limpos: Record<string, unknown> = {};
  const erros: string[] = [];
  for (const [k, v] of Object.entries(dados)) {
    const c = permitidos.get(k);
    if (!c) continue; // campos de controle e desconhecidos são ignorados
    if (c.tipo === 'arquivo') continue;
    if (!valorValido(c, v)) erros.push(`valor inválido em ${k}`);
    else limpos[k] = v;
  }
  return { limpos, erros };
}

function faltando(col: Colecao, reg: Record<string, unknown>): string[] {
  const obrig = col.campos.filter((c) => c.obrigatorio && c.tipo !== 'arquivo').map((c) => c.nome);
  if (col.porViveiro) obrig.push('viveiro_id');
  return obrig.filter((k) => reg[k] === undefined || reg[k] === null || reg[k] === '' || (Array.isArray(reg[k]) && !(reg[k] as unknown[]).length));
}

function ajustarCodigo(col: Colecao, reg: Registro, porta: PortaServidor): { de: string; para: string } | undefined {
  if (!col.prefixoCodigo || typeof reg.codigo !== 'string') return undefined;
  const codigo = reg.codigo;
  // Um código definitivo fora da faixa do aparelho é aceito se estiver livre
  // (ex.: digitado pelo gestor online); provisórios e repetidos são trocados.
  if (!ehProvisorio(codigo) && !porta.codigoEmUso(col.nome, codigo, reg.id)) return undefined;
  const novo = porta.novoCodigo(col, reg);
  reg.codigo = novo;
  return { de: codigo, para: novo };
}

export function resolverOperacao(op: Operacao, atual: Registro | null, ctx: ContextoUsuario, porta: PortaServidor): Decisao {
  if (!existeColecao(op.colecao)) return rejeitar(op, `coleção desconhecida: ${op.colecao}`);
  const col = buscarColecao(op.colecao);

  if (op.tipo === 'excluir') return excluir(op, col, atual, ctx);

  const { limpos, erros } = limparDados(col, op.dados ?? {});
  if (erros.length) return rejeitar(op, erros.join('; '), atual);

  if (op.tipo === 'criar' && !atual) return criar(op, col, limpos, ctx, porta);
  if (!atual) return rejeitar(op, 'registro não existe no servidor');
  if (atual.excluido) return rejeitar(op, 'registro foi excluído', atual);
  if (col.natureza === 'evento') {
    // Reenvio de um evento já gravado: nada a fazer.
    if (op.tipo === 'criar' && Object.entries(limpos).every(([k, v]) => iguais(atual[k], v))) {
      return { gravar: null, resultado: resultado(op, 'aplicada', { registro: atual }), auditoria: null, conflitos: [] };
    }
    return rejeitar(op, 'eventos não podem ser alterados; registre um novo evento de correção', atual);
  }
  // 'criar' de um registro que já existe é tratado como alteração sem base.
  const base = op.tipo === 'criar' ? {} : op.base ?? {};
  const baseVersao = op.tipo === 'criar' ? -1 : op.base_versao;
  return alterar(op, col, atual, limpos, base, baseVersao, ctx);
}

function criar(op: Operacao, col: Colecao, limpos: Record<string, unknown>, ctx: ContextoUsuario, porta: PortaServidor): Decisao {
  const reg: Registro = {
    ...limpos,
    id: op.registro_id,
    versao: 1,
    excluido: false,
    criado_por: ctx.id,
    atualizado_por: ctx.id,
    dispositivo_id: op.dispositivo_id,
    criado_no_aparelho_em: op.criado_no_aparelho_em,
  };
  if (col.campoDono && col.campoDono !== 'criado_por' && escreveComoSolicitante(ctx, col, { ...reg, [col.campoDono]: ctx.id })) {
    reg[col.campoDono] = ctx.id;
  }
  const falta = faltando(col, reg);
  if (falta.length) return rejeitar(op, `faltam campos obrigatórios: ${falta.join(', ')}`);
  if (!podeEscrever(ctx, col, reg)) return rejeitar(op, 'sem permissão para criar este registro');
  const regraCriar = violacaoRegra(col, null, reg, ctx);
  if (regraCriar) return rejeitar(op, regraCriar);
  const codigo_alterado = ajustarCodigo(col, reg, porta);
  return {
    gravar: reg,
    resultado: resultado(op, 'aplicada', { registro: reg, codigo_alterado }),
    auditoria: { acao: 'criar', antes: null, depois: { ...limpos, ...(codigo_alterado ? { codigo: reg.codigo } : {}) } },
    conflitos: [],
  };
}

function alterar(
  op: Operacao,
  col: Colecao,
  atual: Registro,
  limpos: Record<string, unknown>,
  base: Record<string, unknown>,
  baseVersao: number,
  ctx: ContextoUsuario,
): Decisao {
  if (!podeEscrever(ctx, col, atual)) return rejeitar(op, 'sem permissão para alterar este registro', atual);

  const aplicar: Record<string, unknown> = {};
  const conflitos: ConflitoCampo[] = [];
  const semMudancaNoServidor = atual.versao === baseVersao;

  for (const [campo, novo] of Object.entries(limpos)) {
    const servidor = atual[campo];
    if (iguais(servidor, novo)) continue;
    if (semMudancaNoServidor || (campo in base && iguais(servidor, base[campo]))) {
      aplicar[campo] = novo;
    } else {
      conflitos.push({ campo, valor_base: base[campo], valor_aparelho: novo, valor_servidor: servidor });
    }
  }

  if (!Object.keys(aplicar).length) {
    return {
      gravar: null,
      resultado: resultado(op, conflitos.length ? 'conflito' : 'aplicada', { registro: atual, conflitos: conflitos.length ? conflitos : undefined }),
      auditoria: null,
      conflitos,
    };
  }

  const novo: Registro = { ...atual, ...aplicar, versao: atual.versao + 1, atualizado_por: ctx.id };
  if (col.campoDono && col.campoDono !== 'criado_por' && !iguais(atual[col.campoDono], novo[col.campoDono]) && escreveComoSolicitante(ctx, col, atual)) {
    return rejeitar(op, 'o solicitante não pode trocar o dono do registro', atual);
  }
  if (!podeEscrever(ctx, col, novo)) return rejeitar(op, 'sem permissão para gravar nesse viveiro', atual);
  const regra = violacaoRegra(col, atual, novo, ctx);
  if (regra) return rejeitar(op, regra, atual);
  const falta = faltando(col, novo);
  if (falta.length) return rejeitar(op, `faltam campos obrigatórios: ${falta.join(', ')}`, atual);

  // Matriz reprovada pelo gestor vai para a lixeira (some dos aparelhos; o administrador pode restaurar).
  if (col.nome === 'matriz' && novo.situacao_validacao === 'reprovada' && atual.situacao_validacao !== 'reprovada') {
    novo.excluido = true;
    aplicar.excluido = true;
  }
  const antes: Record<string, unknown> = {};
  for (const k of Object.keys(aplicar)) antes[k] = atual[k];
  return {
    gravar: novo,
    resultado: resultado(op, conflitos.length ? 'conflito' : 'aplicada', { registro: novo, conflitos: conflitos.length ? conflitos : undefined }),
    auditoria: { acao: 'alterar', antes, depois: aplicar },
    conflitos,
  };
}

function excluir(op: Operacao, col: Colecao, atual: Registro | null, ctx: ContextoUsuario): Decisao {
  if (!atual || atual.excluido) return { gravar: null, resultado: resultado(op, 'aplicada', { registro: atual ?? undefined }), auditoria: null, conflitos: [] };
  if (col.natureza === 'evento') return rejeitar(op, 'eventos não podem ser excluídos; registre um evento de correção', atual);
  if (!podeEscrever(ctx, col, atual)) return rejeitar(op, 'sem permissão para excluir este registro', atual);
  const regra = violacaoRegra(col, atual, { ...atual, excluido: true }, ctx);
  if (regra) return rejeitar(op, regra, atual);
  if (atual.versao !== op.base_versao) {
    const conflitos: ConflitoCampo[] = [{ campo: '(exclusão)', valor_base: op.base_versao, valor_aparelho: 'excluir', valor_servidor: atual.versao }];
    return {
      gravar: null,
      resultado: resultado(op, 'conflito', { registro: atual, conflitos, motivo: 'o registro foi alterado por outra pessoa; a exclusão não foi feita' }),
      auditoria: null,
      conflitos,
    };
  }
  const novo: Registro = { ...atual, excluido: true, versao: atual.versao + 1, atualizado_por: ctx.id };
  return {
    gravar: novo,
    resultado: resultado(op, 'aplicada', { registro: novo }),
    auditoria: { acao: 'excluir', antes: { excluido: false }, depois: { excluido: true } },
    conflitos: [],
  };
}

