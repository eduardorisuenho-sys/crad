/**
 * Esquema único do CRADS.
 *
 * Esta é a fonte da verdade das coleções: o servidor (PocketBase) gera as
 * coleções a partir daqui e o aparelho (Dexie) cria as tabelas locais a partir
 * daqui. Ver docs/02-modelo-de-dados.md.
 */

export type Perfil = 'coletor' | 'viveirista' | 'gestor' | 'solicitante';
export const PERFIS: Perfil[] = ['coletor', 'viveirista', 'gestor', 'solicitante'];

export type TipoCampo =
  | 'texto'
  | 'numero'
  | 'bool'
  | 'data' // data/hora ISO 8601 em texto
  | 'json'
  | 'arquivo'
  | 'ref' // id de outro registro
  | 'opcao'; // valor de uma lista fechada

export interface Campo {
  nome: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  /** coleção referenciada (tipo 'ref') */
  ref?: string;
  /** valores permitidos (tipo 'opcao') */
  opcoes?: readonly string[];
  /** aceita vários valores (lista) */
  multiplo?: boolean;
}

/**
 * - cadastro: pode ser editado; conflitos resolvidos campo a campo.
 * - evento: só acréscimo; nunca é alterado depois de criado (correção = novo evento).
 */
export type Natureza = 'cadastro' | 'evento';

export interface Colecao {
  nome: string;
  natureza: Natureza;
  /** separada por viveiro (tem `viveiro_id` obrigatório) */
  porViveiro: boolean;
  campos: Campo[];
  /** campos indexados no aparelho (além de id, seq e viveiro_id) */
  indices?: string[];
  /** quem recebe na sincronização. 'todos' = qualquer usuário logado */
  leitura: Perfil[] | 'todos';
  /** quem pode criar/alterar */
  escrita: Perfil[];
  /**
   * Campo com o id do usuário dono. O solicitante só lê e escreve registros
   * em que ele é o dono.
   */
  campoDono?: string;
  /** registros e arquivos visíveis sem login (ex.: fotos do catálogo) */
  publico?: boolean;
  /** prefixo de código legível gerado por faixa (MT, LS, LM, DO) */
  prefixoCodigo?: PrefixoCodigo;
}

export type PrefixoCodigo = 'MT' | 'LS' | 'LM' | 'DO';

/** Campos de controle presentes em todo registro sincronizado. */
export const CAMPOS_CONTROLE = [
  'id',
  'versao',
  'seq',
  'excluido',
  'criado_por',
  'atualizado_por',
  'dispositivo_id',
  'criado_no_aparelho_em',
  'created',
  'updated',
] as const;

// ---------------------------------------------------------------------------
// atalhos
const t = (nome: string, obrigatorio = false): Campo => ({ nome, tipo: 'texto', obrigatorio });
const n = (nome: string, obrigatorio = false): Campo => ({ nome, tipo: 'numero', obrigatorio });
const b = (nome: string): Campo => ({ nome, tipo: 'bool' });
const d = (nome: string, obrigatorio = false): Campo => ({ nome, tipo: 'data', obrigatorio });
const j = (nome: string): Campo => ({ nome, tipo: 'json' });
const arq = (nome: string): Campo => ({ nome, tipo: 'arquivo' });
const r = (nome: string, ref: string, obrigatorio = false): Campo => ({ nome, tipo: 'ref', ref, obrigatorio });
const o = (nome: string, opcoes: readonly string[], obrigatorio = false, multiplo = false): Campo => ({
  nome,
  tipo: 'opcao',
  opcoes,
  obrigatorio,
  multiplo,
});

// listas fechadas -----------------------------------------------------------
export const BIOMAS = ['amazonia', 'caatinga', 'cerrado', 'mata_atlantica', 'pampa', 'pantanal'] as const;
export const GRAUS_CERTEZA = ['certo', 'provavel', 'a_identificar'] as const;
export const PARTES_PLANTA = ['arvore', 'tronco', 'casca', 'folha', 'ramo', 'flor', 'fruto', 'semente', 'muda', 'outro'] as const;
/** fotos obrigatórias no cadastro da matriz */
export const FOTOS_OBRIGATORIAS_MATRIZ = ['arvore', 'tronco', 'folha'] as const;
export const FENOFASES = ['folha', 'flor', 'fruto_verde', 'fruto_maduro', 'sem_folha'] as const;
/** embalagens usadas hoje (planilha de controle de mudas) */
export const RECIPIENTES = ['tubete', 'saquinho', 'sementeira', 'outros'] as const;
export const TIPOS_LOCAL_MATRIZ = ['app', 'mata', 'praca', 'propriedade_rural', 'beira_estrada', 'outro'] as const;
export const SITUACOES_VALIDACAO = ['pendente', 'aprovada', 'reprovada'] as const;
export const ORIGENS_ESPECIE = ['nativa', 'naturalizada', 'cultivada', 'exotica', 'desconhecida'] as const;
/** [hipótese] fases do viveiro — conferir com a especificação */
export const FASES_MUDA = ['semeadura', 'germinacao', 'repicagem', 'crescimento', 'rustificacao', 'pronta'] as const;
export const SITUACOES_DOACAO = [
  'rascunho',
  'enviada',
  'em_analise',
  'aprovada',
  'aprovada_parcial',
  'negada',
  'aguardando_retirada',
  'retirada',
  'expirada',
  'cancelada',
] as const;

const TODOS_EXCETO_SOLICITANTE: Perfil[] = ['coletor', 'viveirista', 'gestor'];
const EQUIPE_VIVEIRO: Perfil[] = ['viveirista', 'gestor'];
const SO_GESTOR: Perfil[] = ['gestor'];

// ---------------------------------------------------------------------------
export const COLECOES: Colecao[] = [
  // ---- organização --------------------------------------------------------
  {
    nome: 'instalacao',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('nome_orgao', true), t('uf_padrao', true), arq('logotipo'), t('cabecalho_documentos'), t('texto_termo_doacao')],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  {
    nome: 'viveiro',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('sigla', true), t('nome', true), r('municipio_id', 'municipio'), t('endereco'), t('telefone'), b('ativo')],
    indices: ['sigla'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  {
    nome: 'municipio',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('codigo_ibge', true), t('nome', true), t('uf', true), o('biomas', BIOMAS, false, true), j('contorno')],
    indices: ['codigo_ibge', 'uf'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  {
    nome: 'usuario_viveiro',
    natureza: 'cadastro',
    porViveiro: true,
    campos: [r('usuario_id', 'users', true), o('perfil', ['coletor', 'viveirista', 'gestor'], true)],
    indices: ['usuario_id'],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR,
  },
  {
    // Pedido de acesso de quem se cadastrou pelo celular como coletor ou viveirista.
    nome: 'pedido_acesso',
    natureza: 'cadastro',
    porViveiro: true,
    campos: [r('usuario_id', 'users', true), t('nome'), t('email'), o('perfil', ['coletor', 'viveirista'], true), o('situacao', ['pendente', 'aprovado', 'recusado'], true), r('analisado_por', 'users'), t('motivo')],
    indices: ['usuario_id'],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR,
  },
  {
    nome: 'pessoa',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('nome', true), o('tipo', ['fisica', 'juridica']), t('instituicao'), r('municipio_id', 'municipio'), r('usuario_id', 'users')],
    indices: ['nome', 'usuario_id'],
    leitura: 'todos',
    escrita: ['coletor', 'viveirista', 'gestor', 'solicitante'],
    campoDono: 'usuario_id',
  },
  {
    // LGPD: CPF/CNPJ e telefone ficam aqui e só o gestor lê.
    nome: 'dados_pessoais',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [r('pessoa_id', 'pessoa', true), t('documento'), t('telefone'), t('email')],
    indices: ['pessoa_id'],
    leitura: SO_GESTOR,
    escrita: ['coletor', 'viveirista', 'gestor', 'solicitante'],
  },
  {
    nome: 'parametro',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('chave', true), j('valor'), r('viveiro_id', 'viveiro'), t('descricao')],
    indices: ['chave'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  {
    nome: 'meta',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('indicador', true), n('alvo', true), n('ano'), r('viveiro_id', 'viveiro'), r('especie_id', 'especie'), r('programa_id', 'programa')],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },

  // ---- espécies e assistente ---------------------------------------------
  {
    nome: 'especie',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [
      t('nome_cientifico', true),
      t('autor'),
      t('familia'),
      t('flora_id'),
      t('forma_vida'),
      b('endemica'),
      t('folha'),
      t('disposicao'),
      t('latex'),
      t('espinhos'),
      t('casca'),
      t('flor'),
      t('fruto'),
      j('meses_flor'), // lista de meses 1..12
      j('meses_fruto'),
      n('lorenzi_volume'),
      n('lorenzi_pagina'),
      // [hipótese] dados de sementes e mudas — ajustar pela tabela de sementes e mudas
      n('sementes_por_kg'),
      t('dormencia'),
      t('tratamento_pre_germinativo'),
      n('dias_germinacao'),
      n('meses_ate_pronta'),
      t('grupo_sucessional'),
      o('origem', ORIGENS_ESPECIE),
      b('ficticia'),
      b('publicada'),
      // importação: casos que a equipe precisa conferir (família conflitante, nome ambíguo…)
      b('revisar'),
      t('nota_revisao'),
      o('fonte_cadastro', ['planilha', 'flora_funga', 'manual']),
    ],
    indices: ['nome_cientifico', 'familia', 'flora_id'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  { nome: 'sinonimo', natureza: 'cadastro', porViveiro: false, campos: [r('especie_id', 'especie', true), t('nome', true)], indices: ['especie_id', 'nome'], leitura: 'todos', escrita: SO_GESTOR },
  { nome: 'nome_popular', natureza: 'cadastro', porViveiro: false, campos: [r('especie_id', 'especie', true), t('nome', true), t('nome_busca'), t('regiao')], indices: ['especie_id', 'nome', 'nome_busca'], leitura: 'todos', escrita: SO_GESTOR },
  {
    nome: 'especie_ocorrencia',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [r('especie_id', 'especie', true), t('uf', true), o('bioma', BIOMAS), o('origem', ['flora_funga', 'manual'])],
    indices: ['especie_id', 'uf'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  { nome: 'especie_municipio', natureza: 'cadastro', porViveiro: false, campos: [r('especie_id', 'especie', true), r('municipio_id', 'municipio', true)], indices: ['especie_id', 'municipio_id'], leitura: 'todos', escrita: SO_GESTOR },
  { nome: 'especie_confusao', natureza: 'cadastro', porViveiro: false, campos: [r('especie_a_id', 'especie', true), r('especie_b_id', 'especie', true), t('como_diferenciar')], indices: ['especie_a_id', 'especie_b_id'], leitura: 'todos', escrita: SO_GESTOR },
  {
    nome: 'especie_foto',
    natureza: 'cadastro',
    porViveiro: false,
    publico: true,
    campos: [r('especie_id', 'especie', true), o('parte', PARTES_PLANTA, true), arq('arquivo'), arq('miniatura'), t('credito'), t('licenca')],
    indices: ['especie_id'],
    leitura: 'todos',
    escrita: SO_GESTOR,
  },
  { nome: 'pergunta', natureza: 'cadastro', porViveiro: false, campos: [t('texto', true), t('chave'), o('parte', PARTES_PLANTA), n('ordem'), b('ativa')], indices: ['ordem', 'chave'], leitura: 'todos', escrita: SO_GESTOR },
  { nome: 'opcao', natureza: 'cadastro', porViveiro: false, campos: [r('pergunta_id', 'pergunta', true), t('rotulo', true), t('chave'), arq('figura'), t('figura_padrao'), n('ordem')], indices: ['pergunta_id', 'chave'], leitura: 'todos', escrita: SO_GESTOR },
  { nome: 'especie_opcao', natureza: 'cadastro', porViveiro: false, campos: [r('especie_id', 'especie', true), r('opcao_id', 'opcao', true)], indices: ['especie_id', 'opcao_id'], leitura: 'todos', escrita: SO_GESTOR },

  // ---- módulo 1: matrizes -------------------------------------------------
  {
    nome: 'matriz',
    natureza: 'cadastro',
    porViveiro: true,
    prefixoCodigo: 'MT',
    campos: [
      t('codigo', true),
      r('especie_id', 'especie'),
      o('grau_certeza', GRAUS_CERTEZA, true),
      o('metodo_identificacao', ['assistente', 'manual', 'foto_lens']),
      j('respostas_assistente'),
      r('municipio_id', 'municipio'),
      n('lat'),
      n('lon'),
      n('precisao_m'),
      n('altitude'),
      t('descricao_local'),
      r('proprietario_pessoa_id', 'pessoa'),
      b('autorizacao_proprietario'),
      o('tipo_local', TIPOS_LOCAL_MATRIZ),
      n('dap_cm'),
      n('cap_cm'),
      n('altura_m'),
      o('estado_fitossanitario', ['bom', 'regular', 'ruim']),
      o('situacao', ['ativa', 'inativa', 'morta']),
      r('coletor_id', 'users'),
      t('observacao'),
      // validação pelo gestor: só matriz aprovada vai para coleta
      o('situacao_validacao', SITUACOES_VALIDACAO),
      r('validado_por', 'users'),
      d('validado_em'),
      t('nota_validacao'),
    ],
    indices: ['codigo', 'especie_id', 'municipio_id', 'situacao_validacao'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ['coletor', 'gestor'],
  },
  {
    // Foto genérica (matriz, coleta, lote, retirada, monitoramento…).
    nome: 'foto',
    natureza: 'evento',
    porViveiro: true,
    campos: [t('entidade', true), t('registro_id', true), o('parte', PARTES_PLANTA), arq('arquivo'), arq('miniatura'), n('lat'), n('lon'), d('tirada_em')],
    indices: ['registro_id'],
    leitura: 'todos',
    escrita: ['coletor', 'viveirista', 'gestor', 'solicitante'],
    campoDono: 'criado_por',
  },
  {
    nome: 'sugestao_identificacao',
    natureza: 'cadastro',
    porViveiro: true,
    campos: [r('matriz_id', 'matriz', true), o('fonte', ['plantnet', 'inaturalist']), r('especie_id', 'especie'), t('nome_sugerido'), n('pontuacao'), o('situacao', ['pendente', 'aceita', 'rejeitada']), r('revisado_por', 'users')],
    indices: ['matriz_id'],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR,
  },
  {
    // Registro de fenologia a cada visita (calendário de frutificação).
    nome: 'fenologia',
    natureza: 'evento',
    porViveiro: true,
    campos: [r('matriz_id', 'matriz', true), d('data', true), o('fases', FENOFASES, true, true), t('observacao')],
    indices: ['matriz_id', 'data'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ['coletor', 'viveirista', 'gestor'],
  },
  { nome: 'rota_campo', natureza: 'cadastro', porViveiro: true, campos: [r('coletor_id', 'users'), d('data'), j('matrizes_planejadas'), t('observacao')], leitura: TODOS_EXCETO_SOLICITANTE, escrita: ['coletor', 'gestor'] },

  // ---- módulo 2: coleta e sementes ---------------------------------------
  {
    nome: 'coleta',
    natureza: 'cadastro',
    porViveiro: true,
    // matriz_id vazio = árvore sem matriz cadastrada (aí a espécie vem em especie_id)
    campos: [r('matriz_id', 'matriz'), r('especie_id', 'especie'), d('data', true), r('coletor_id', 'users'), o('material', ['fruto', 'semente']), n('quantidade'), o('unidade', ['g', 'kg', 'litros', 'frutos', 'unidades']), n('lat'), n('lon'), t('observacao')],
    indices: ['matriz_id', 'especie_id', 'data'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ['coletor', 'viveirista', 'gestor'],
  },
  {
    nome: 'endereco_armazenamento',
    natureza: 'cadastro',
    porViveiro: true,
    campos: [t('codigo', true), t('local'), t('estante'), t('prateleira'), t('caixa'), b('ativo')],
    indices: ['codigo'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },
  {
    nome: 'lote_sementes',
    natureza: 'cadastro',
    porViveiro: true,
    prefixoCodigo: 'LS',
    campos: [
      t('codigo', true),
      r('especie_id', 'especie', true),
      // estoque_inicial = sementes que já estavam no viveiro antes do app
      o('origem', ['coleta', 'estoque_inicial']),
      t('observacao_origem'),
      d('data_formacao'),
      n('peso_g'),
      n('sementes_estimadas'),
      n('umidade_pct'),
      n('germinacao_teste_pct'),
      r('endereco_id', 'endereco_armazenamento'),
      d('validade'),
      o('situacao', ['armazenado', 'em_uso', 'esgotado', 'descartado']),
      t('observacao'),
    ],
    indices: ['codigo', 'especie_id'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },
  { nome: 'lote_sementes_coleta', natureza: 'cadastro', porViveiro: true, campos: [r('lote_sementes_id', 'lote_sementes', true), r('coleta_id', 'coleta', true), n('quantidade')], indices: ['lote_sementes_id', 'coleta_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  {
    nome: 'movimento_sementes',
    natureza: 'evento',
    porViveiro: true,
    campos: [r('lote_sementes_id', 'lote_sementes', true), o('tipo', ['entrada', 'semeadura', 'teste', 'descarte', 'mudanca_endereco', 'ajuste'], true), n('quantidade_g'), n('quantidade_unid'), d('data', true), r('lote_mudas_id', 'lote_mudas'), r('endereco_id', 'endereco_armazenamento'), t('observacao')],
    indices: ['lote_sementes_id'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },

  // ---- módulo 3: viveiro --------------------------------------------------
  {
    nome: 'lote_mudas',
    natureza: 'cadastro',
    porViveiro: true,
    prefixoCodigo: 'LM',
    // origem "estoque_inicial": mudas que já estavam no viveiro antes do app (sem lote de sementes).
    campos: [t('codigo', true), o('origem', ['semeadura', 'estoque_inicial']), r('lote_sementes_id', 'lote_sementes'), t('observacao_origem'), r('especie_id', 'especie', true), d('data_semeadura'), n('sementes_semeadas'), n('sementes_semeadas_g'), o('recipiente', RECIPIENTES), t('canteiro'), o('fase_atual', FASES_MUDA), o('situacao', ['ativo', 'encerrado'])],
    indices: ['codigo', 'lote_sementes_id', 'especie_id', 'fase_atual'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },
  {
    nome: 'evento_lote_mudas',
    natureza: 'evento',
    porViveiro: true,
    campos: [r('lote_mudas_id', 'lote_mudas', true), o('tipo', ['semeadura', 'contagem_germinacao', 'repicagem', 'mudanca_fase', 'medicao', 'perda', 'transferencia'], true), d('data', true), n('quantidade'), t('causa'), n('altura_media_cm'), o('fase_nova', FASES_MUDA), t('observacao')],
    indices: ['lote_mudas_id', 'tipo'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },
  {
    // Livro-razão do estoque de mudas: o saldo é sempre a soma dos movimentos.
    nome: 'movimento_estoque_mudas',
    natureza: 'evento',
    porViveiro: true,
    campos: [r('lote_mudas_id', 'lote_mudas', true), o('tipo', ['entrada', 'perda', 'ajuste_inventario', 'saida_doacao', 'transferencia'], true), n('quantidade', true), d('data', true), t('referencia')],
    indices: ['lote_mudas_id'],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO,
  },
  { nome: 'inventario', natureza: 'cadastro', porViveiro: true, campos: [d('data', true), r('responsavel_id', 'users'), o('situacao', ['aberto', 'fechado'])], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: 'inventario_item', natureza: 'cadastro', porViveiro: true, campos: [r('inventario_id', 'inventario', true), r('lote_mudas_id', 'lote_mudas', true), n('contado'), n('saldo_sistema')], indices: ['inventario_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },

  // ---- módulo 5: doação ---------------------------------------------------
  {
    nome: 'doacao',
    natureza: 'cadastro',
    porViveiro: true,
    prefixoCodigo: 'DO',
    campoDono: 'solicitante_usuario_id',
    campos: [
      t('codigo', true),
      r('solicitante_pessoa_id', 'pessoa', true),
      r('solicitante_usuario_id', 'users'),
      t('instituicao'),
      t('finalidade'),
      r('municipio_plantio_id', 'municipio'),
      t('local_plantio'),
      j('geometria_plantio'),
      n('area_ha'),
      o('canal', ['online', 'balcao']),
      arq('oficio'),
      o('situacao', SITUACOES_DOACAO, true),
      r('analisado_por', 'users'),
      d('analisado_em'),
      t('justificativa'),
      d('retirar_ate'),
      // retirada combinada entre o viveiro e quem pediu
      d('retirada_combinada'),
      t('retirada_obs'),
    ],
    indices: ['codigo', 'situacao', 'solicitante_usuario_id'],
    leitura: 'todos',
    escrita: ['viveirista', 'gestor', 'solicitante'],
  },
  { nome: 'doacao_item', natureza: 'cadastro', porViveiro: true, campoDono: 'solicitante_usuario_id', campos: [r('doacao_id', 'doacao', true), r('especie_id', 'especie', true), n('qtd_pedida'), n('qtd_aprovada'), n('qtd_entregue'), r('solicitante_usuario_id', 'users')], indices: ['doacao_id'], leitura: 'todos', escrita: ['viveirista', 'gestor', 'solicitante'] },
  { nome: 'reserva', natureza: 'cadastro', porViveiro: true, campos: [r('doacao_item_id', 'doacao_item', true), r('lote_mudas_id', 'lote_mudas', true), n('quantidade', true), d('valida_ate'), o('situacao', ['ativa', 'consumida', 'expirada', 'cancelada'], true)], indices: ['doacao_item_id', 'lote_mudas_id', 'situacao'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: 'doacao_item_lote', natureza: 'evento', porViveiro: true, campos: [r('doacao_item_id', 'doacao_item', true), r('lote_mudas_id', 'lote_mudas', true), n('quantidade', true)], indices: ['doacao_item_id', 'lote_mudas_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: 'retirada', natureza: 'cadastro', porViveiro: true, campos: [r('doacao_id', 'doacao', true), d('data', true), t('recebedor_nome'), r('recebedor_pessoa_id', 'pessoa'), arq('assinatura'), arq('termo_pdf'), r('entregue_por', 'users')], indices: ['doacao_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: 'programa', natureza: 'cadastro', porViveiro: false, campos: [t('nome', true), t('icone'), t('cor'), b('ativo')], leitura: 'todos', escrita: SO_GESTOR },
  { nome: 'doacao_programa', natureza: 'cadastro', porViveiro: true, campos: [r('doacao_id', 'doacao', true), r('programa_id', 'programa', true), b('ativo')], indices: ['doacao_id', 'programa_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: 'doacao_programa_historico', natureza: 'evento', porViveiro: true, campos: [r('doacao_id', 'doacao', true), r('programa_id', 'programa', true), o('acao', ['marcou', 'desmarcou'], true), t('motivo'), t('usuario_nome')], indices: ['doacao_id'], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },

  // ---- módulo 6: pós-plantio ---------------------------------------------
  { nome: 'plantio', natureza: 'cadastro', porViveiro: true, campoDono: 'solicitante_usuario_id', campos: [r('doacao_id', 'doacao', true), d('data'), j('geometria'), r('municipio_id', 'municipio'), t('local'), t('responsavel'), r('solicitante_usuario_id', 'users')], indices: ['doacao_id'], leitura: 'todos', escrita: ['viveirista', 'gestor', 'solicitante'] },
  { nome: 'plantio_item', natureza: 'cadastro', porViveiro: true, campoDono: 'solicitante_usuario_id', campos: [r('plantio_id', 'plantio', true), r('especie_id', 'especie', true), n('quantidade'), r('solicitante_usuario_id', 'users')], indices: ['plantio_id'], leitura: 'todos', escrita: ['viveirista', 'gestor', 'solicitante'] },
  { nome: 'monitoramento', natureza: 'cadastro', porViveiro: true, campoDono: 'solicitante_usuario_id', campos: [r('plantio_id', 'plantio', true), d('data', true), o('tipo', ['relato', 'vistoria'], true), r('validado_por', 'users'), t('observacao'), r('solicitante_usuario_id', 'users')], indices: ['plantio_id'], leitura: 'todos', escrita: ['viveirista', 'gestor', 'solicitante'] },
  { nome: 'monitoramento_item', natureza: 'cadastro', porViveiro: true, campoDono: 'solicitante_usuario_id', campos: [r('monitoramento_id', 'monitoramento', true), r('especie_id', 'especie', true), n('plantadas'), n('vivas'), r('solicitante_usuario_id', 'users')], indices: ['monitoramento_id'], leitura: 'todos', escrita: ['viveirista', 'gestor', 'solicitante'] },

  // ---- módulo 7 e controle -----------------------------------------------
  { nome: 'publicacao', natureza: 'cadastro', porViveiro: false, campos: [t('titulo', true), d('data'), j('conteudo'), b('publicada')], leitura: SO_GESTOR, escrita: SO_GESTOR },
  {
    // Criado pelo servidor quando o mesmo campo mudou no aparelho e no servidor.
    nome: 'conflito',
    natureza: 'cadastro',
    porViveiro: false,
    campos: [t('colecao', true), t('registro_id', true), j('campos'), r('usuario_id', 'users'), o('situacao', ['aberto', 'resolvido'], true), r('resolvido_por', 'users')],
    indices: ['registro_id', 'situacao'],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR,
  },
];

const POR_NOME = new Map(COLECOES.map((c) => [c.nome, c]));

export function colecao(nome: string): Colecao {
  const c = POR_NOME.get(nome);
  if (!c) throw new Error(`Coleção desconhecida: ${nome}`);
  return c;
}

export function existeColecao(nome: string): boolean {
  return POR_NOME.has(nome);
}

/** Campos editáveis de uma coleção (sem os de controle), incluindo viveiro_id quando houver. */
export function nomesCampos(c: Colecao): string[] {
  const nomes = c.campos.map((f) => f.nome);
  if (c.porViveiro) nomes.push('viveiro_id');
  return nomes;
}

/** Parâmetros editáveis pelo gestor, com valores padrão. */
export const PARAMETROS_PADRAO: Record<string, { valor: unknown; descricao: string }> = {
  meta_matrizes_por_especie: { valor: 12, descricao: 'Meta de matrizes por espécie' },
  min_matrizes_por_lote: { valor: 12, descricao: 'Mínimo de matrizes num lote de sementes antes do alerta de diversidade' },
  distancia_min_matrizes_m: { valor: 100, descricao: 'Distância mínima entre matrizes da mesma espécie (metros)' },
  prazo_retirada_dias: { valor: 30, descricao: 'Dias para retirar as mudas depois da aprovação' },
  limite_mudas_por_especie: { valor: 30, descricao: 'Máximo de mudas de cada espécie num pedido (o total do pedido não tem limite)' },
  perfis_aprovadores: { valor: ['gestor'], descricao: 'Perfis que podem aprovar doações' },
  dias_sessao_offline: { valor: 30, descricao: 'Dias que o aparelho pode ficar sem entrar na internet antes de pedir login de novo' },
  fotos_obrigatorias_matriz: { valor: ['arvore', 'folha'], descricao: 'Fotos que o coletor precisa tirar para salvar a matriz' },
  precisao_gps_maxima_m: { valor: 30, descricao: 'Precisão do GPS (metros) a partir da qual o app aceita o ponto sem perguntar' },
  aviso_validade_sementes_dias: { valor: 60, descricao: 'Avisar quando faltar este número de dias para a validade de um lote de sementes' },
  distancia_max_foto_plantio_m: { valor: 500, descricao: 'Fotos do plantio mais longe que isto (metros) ficam marcadas para conferência' },
  tamanho_faixa_codigos: { valor: 20, descricao: 'Quantos códigos cada aparelho reserva por tipo no pacote de campo' },
};
