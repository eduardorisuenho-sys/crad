/**
 * Permissões por funcionalidade (tabela da tela "Permissões").
 * Cada linha é uma coisa que se faz no app; cada coluna, um perfil.
 * O administrador (gestor geral) pode tudo e não aparece como editável.
 * O padrão reproduz exatamente as regras do esquema: sem mudança na
 * tabela, nada muda no acesso.
 */
import type { ContextoUsuario } from './acesso';
import type { Colecao, Perfil } from './esquema';

export interface Funcionalidade {
  chave: string;
  grupo: string;
  rotulo: string;
  /** perfis com acesso quando ninguém mudou a tabela */
  padrao: Perfil[];
  /** coleções que esta funcionalidade grava */
  escrita?: string[];
  /** o solicitante (cidadão) pode receber esta permissão? */
  solicitantePode?: boolean;
  /** linha fixa: ninguém muda (ex.: LGPD) */
  fixa?: boolean;
  /** só o administrador */
  soAdministrador?: boolean;
}

export const GRUPOS_PERMISSAO = ['Matrizes', 'Coleta e sementes', 'Viveiro', 'Doação de mudas', 'Pós-plantio', 'Espécies', 'Relatórios', 'Gestão'] as const;

export const FUNCIONALIDADES: Funcionalidade[] = [
  { chave: 'cadastrar_matriz', grupo: 'Matrizes', rotulo: 'Cadastrar matriz e rota de campo', padrao: ['coletor', 'gestor'], escrita: ['matriz', 'rota_campo'] },
  { chave: 'fenologia', grupo: 'Matrizes', rotulo: 'Registrar flor e fruto', padrao: ['coletor', 'viveirista', 'gestor'], escrita: ['fenologia'] },
  { chave: 'validar_matriz', grupo: 'Matrizes', rotulo: 'Aprovar matriz para coleta', padrao: ['gestor'] },
  { chave: 'registrar_coleta', grupo: 'Coleta e sementes', rotulo: 'Registrar coleta de sementes', padrao: ['coletor', 'viveirista', 'gestor'], escrita: ['coleta'] },
  { chave: 'lotes_sementes', grupo: 'Coleta e sementes', rotulo: 'Formar lotes e guardar sementes', padrao: ['viveirista', 'gestor'], escrita: ['lote_sementes', 'lote_sementes_coleta', 'movimento_sementes', 'endereco_armazenamento'] },
  { chave: 'producao', grupo: 'Viveiro', rotulo: 'Semear e cuidar das mudas', padrao: ['viveirista', 'gestor'], escrita: ['lote_mudas', 'evento_lote_mudas', 'movimento_estoque_mudas'] },
  { chave: 'estoque_inicial', grupo: 'Viveiro', rotulo: 'Cadastrar mudas que já estavam no viveiro', padrao: ['viveirista', 'gestor'], escrita: ['lote_mudas', 'movimento_estoque_mudas'] },
  { chave: 'inventario', grupo: 'Viveiro', rotulo: 'Fazer inventário', padrao: ['viveirista', 'gestor'], escrita: ['inventario', 'inventario_item', 'movimento_estoque_mudas'] },
  { chave: 'pedir_mudas', grupo: 'Doação de mudas', rotulo: 'Pedir mudas', padrao: ['viveirista', 'gestor', 'solicitante'], escrita: ['doacao', 'doacao_item'], solicitantePode: true },
  { chave: 'aprovar_doacao', grupo: 'Doação de mudas', rotulo: 'Aprovar pedidos de mudas', padrao: ['gestor'] },
  { chave: 'retirada', grupo: 'Doação de mudas', rotulo: 'Entregar mudas (retirada)', padrao: ['viveirista', 'gestor'], escrita: ['retirada', 'reserva', 'doacao_item_lote', 'movimento_estoque_mudas'] },
  { chave: 'plantando_agua', grupo: 'Doação de mudas', rotulo: 'Marcar Plantando Água', padrao: ['viveirista', 'gestor'], escrita: ['doacao_programa', 'doacao_programa_historico'] },
  { chave: 'registrar_plantio', grupo: 'Pós-plantio', rotulo: 'Registrar plantio e acompanhamento', padrao: ['viveirista', 'gestor', 'solicitante'], escrita: ['plantio', 'plantio_item', 'monitoramento', 'monitoramento_item'], solicitantePode: true },
  { chave: 'vistoria', grupo: 'Pós-plantio', rotulo: 'Fazer vistoria técnica', padrao: ['viveirista', 'gestor'] },
  { chave: 'especies', grupo: 'Espécies', rotulo: 'Editar e importar espécies', padrao: ['gestor'], escrita: ['especie', 'sinonimo', 'nome_popular', 'especie_ocorrencia', 'especie_municipio', 'especie_confusao', 'especie_foto', 'pergunta', 'opcao', 'especie_opcao'] },
  { chave: 'relatorios', grupo: 'Relatórios', rotulo: 'Ver relatórios e baixar planilhas', padrao: ['gestor'] },
  { chave: 'dados_pessoais', grupo: 'Relatórios', rotulo: 'Ver CPF e telefone (LGPD)', padrao: ['gestor'], fixa: true },
  { chave: 'viveiros', grupo: 'Gestão', rotulo: 'Cadastrar viveiros e municípios', padrao: ['gestor'], escrita: ['viveiro', 'municipio'] },
  { chave: 'equipe', grupo: 'Gestão', rotulo: 'Cadastrar equipe e aprovar acessos', padrao: ['gestor'], escrita: ['usuario_viveiro', 'pedido_acesso'] },
  { chave: 'parametros', grupo: 'Gestão', rotulo: 'Ajustar parâmetros e metas', padrao: ['gestor'], escrita: ['parametro', 'meta', 'programa'] },
  { chave: 'lixeira', grupo: 'Gestão', rotulo: 'Excluir cadastros e apagar de vez (lixeira)', padrao: [], soAdministrador: true },
  { chave: 'permissoes', grupo: 'Gestão', rotulo: 'Mudar esta tabela de permissões', padrao: [], soAdministrador: true },
];

/** Colunas da tabela (o administrador vem antes, sempre marcado). */
export const PERFIS_PERMISSAO: { perfil: Perfil; rotulo: string }[] = [
  { perfil: 'gestor', rotulo: 'Grupo gestor' },
  { perfil: 'viveirista', rotulo: 'Viveirista' },
  { perfil: 'coletor', rotulo: 'Coletor' },
  { perfil: 'solicitante', rotulo: 'Solicitante' },
];

/** perfis com acesso, por funcionalidade */
export type MatrizPermissoes = Record<string, Perfil[]>;

const ORDEM: Perfil[] = ['coletor', 'viveirista', 'gestor', 'solicitante'];
const ordenar = (ps: Iterable<Perfil>) => ORDEM.filter((p) => new Set(ps).has(p));
const POR_CHAVE = new Map(FUNCIONALIDADES.map((f) => [f.chave, f]));

/** A célula pode ser mudada na tela? */
export function celulaEditavel(f: Funcionalidade, perfil: Perfil): boolean {
  if (f.fixa || f.soAdministrador) return false;
  if (perfil === 'solicitante') return !!f.solicitantePode;
  return true;
}

export function matrizPadrao(): MatrizPermissoes {
  return Object.fromEntries(FUNCIONALIDADES.map((f) => [f.chave, ordenar(f.padrao)]));
}

/** Aplica as travas (células fixas ficam como no padrão). */
export function normalizarMatriz(m: Partial<MatrizPermissoes> | null | undefined): MatrizPermissoes {
  const out: MatrizPermissoes = {};
  for (const f of FUNCIONALIDADES) {
    const marcados = new Set(Array.isArray(m?.[f.chave]) ? (m![f.chave] as Perfil[]) : f.padrao);
    out[f.chave] = ordenar(ORDEM.filter((p) => (celulaEditavel(f, p) ? marcados.has(p) : f.padrao.includes(p))));
  }
  return out;
}

/** Tabela em vigor, lida dos parâmetros (chave "permissoes"). */
export function matrizDe(parametros: { chave?: unknown; valor?: unknown; viveiro_id?: unknown; excluido?: unknown }[]): MatrizPermissoes {
  const p = parametros.find((x) => x.chave === 'permissoes' && !x.excluido && !x.viveiro_id);
  const salvo = (p?.valor && typeof p.valor === 'object' ? (p.valor as Partial<MatrizPermissoes>) : {}) as Partial<MatrizPermissoes>;
  // Compatibilidade: antes, quem aprovava doação ficava no parâmetro perfis_aprovadores.
  if (!salvo.aprovar_doacao) {
    const ap = parametros.find((x) => x.chave === 'perfis_aprovadores' && !x.excluido && !x.viveiro_id);
    if (Array.isArray(ap?.valor)) salvo.aprovar_doacao = ap!.valor as Perfil[];
  }
  return normalizarMatriz(salvo);
}

/** Quem pode gravar na coleção, conforme a tabela. */
export function escritaEfetiva(col: Colecao, m?: MatrizPermissoes): Perfil[] {
  if (!m) return col.escrita;
  const cobrem = FUNCIONALIDADES.filter((f) => f.escrita?.includes(col.nome));
  if (!cobrem.length) return col.escrita;
  const dosPadroes = new Set(cobrem.flatMap((f) => f.padrao));
  const fixos = col.escrita.filter((p) => !dosPadroes.has(p));
  return ordenar([...fixos, ...cobrem.flatMap((f) => m[f.chave] ?? f.padrao)]);
}

export function perfisComPermissao(m: MatrizPermissoes | undefined, chave: string): Perfil[] {
  return (m ?? matrizPadrao())[chave] ?? POR_CHAVE.get(chave)?.padrao ?? [];
}

/**
 * O usuário pode fazer isso (no viveiro informado)? O administrador pode tudo.
 * Sem viveiro, vale qualquer viveiro em que a pessoa tenha um perfil.
 */
export function temPermissao(ctx: Pick<ContextoUsuario, 'gestorGeral' | 'solicitante' | 'perfisPorViveiro'> & { permissoes?: MatrizPermissoes }, chave: string, viveiroId?: unknown): boolean {
  if (ctx.gestorGeral) return true;
  const f = POR_CHAVE.get(chave);
  if (!f || f.soAdministrador) return false;
  const permitidos = new Set(perfisComPermissao(ctx.permissoes, chave));
  if (ctx.solicitante && permitidos.has('solicitante')) return true;
  const listas = typeof viveiroId === 'string' && viveiroId ? [ctx.perfisPorViveiro[viveiroId] ?? []] : Object.values(ctx.perfisPorViveiro);
  return listas.some((ps) => ps.some((p) => permitidos.has(p)));
}
