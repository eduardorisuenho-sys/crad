// Gerado por servidor/scripts/empacotar.ts. Não edite à mão.
"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b2) => {
  for (var prop in b2 || (b2 = {}))
    if (__hasOwnProp.call(b2, prop))
      __defNormalProp(a, prop, b2[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b2)) {
      if (__propIsEnum.call(b2, prop))
        __defNormalProp(a, prop, b2[prop]);
    }
  return a;
};
var __spreadProps = (a, b2) => __defProps(a, __getOwnPropDescs(b2));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/crads.ts
var crads_exports = {};
__export(crads_exports, {
  COLECOES_SINCRONIZADAS: () => COLECOES_SINCRONIZADAS,
  analisarDoacao: () => analisarDoacao,
  antesDeGravarPeloPainel: () => antesDeGravarPeloPainel,
  auditarPainel: () => auditarPainel,
  catalogoPublico: () => catalogoPublico,
  contextoDe: () => contextoDe,
  criarConta: () => criarConta,
  enviar: () => enviar,
  equipe: () => equipe,
  equipeCadastrar: () => equipeCadastrar,
  equipeRemover: () => equipeRemover,
  equipeResponder: () => equipeResponder,
  especiePublica: () => especiePublica,
  eu: () => eu,
  expirarPrazos: () => expirarPrazos,
  paraObjeto: () => paraObjeto,
  rastreioPublico: () => rastreioPublico,
  receber: () => receber,
  receberArquivo: () => receberArquivo,
  reservarFaixas: () => reservarFaixas,
  transparencia: () => transparencia,
  viveirosPublicos: () => viveirosPublicos
});
module.exports = __toCommonJS(crads_exports);

// ../dominio/src/esquema.ts
var t = (nome, obrigatorio = false) => ({ nome, tipo: "texto", obrigatorio });
var n = (nome, obrigatorio = false) => ({ nome, tipo: "numero", obrigatorio });
var b = (nome) => ({ nome, tipo: "bool" });
var d = (nome, obrigatorio = false) => ({ nome, tipo: "data", obrigatorio });
var j = (nome) => ({ nome, tipo: "json" });
var arq = (nome) => ({ nome, tipo: "arquivo" });
var r = (nome, ref, obrigatorio = false) => ({ nome, tipo: "ref", ref, obrigatorio });
var o = (nome, opcoes, obrigatorio = false, multiplo = false) => ({
  nome,
  tipo: "opcao",
  opcoes,
  obrigatorio,
  multiplo
});
var BIOMAS = ["amazonia", "caatinga", "cerrado", "mata_atlantica", "pampa", "pantanal"];
var GRAUS_CERTEZA = ["certo", "provavel", "a_identificar"];
var PARTES_PLANTA = ["arvore", "tronco", "casca", "folha", "ramo", "flor", "fruto", "semente", "muda", "outro"];
var FENOFASES = ["folha", "flor", "fruto_verde", "fruto_maduro", "sem_folha"];
var RECIPIENTES = ["tubete", "saquinho", "sementeira", "outros"];
var TIPOS_LOCAL_MATRIZ = ["app", "mata", "praca", "propriedade_rural", "beira_estrada", "outro"];
var SITUACOES_VALIDACAO = ["pendente", "aprovada", "reprovada"];
var ORIGENS_ESPECIE = ["nativa", "naturalizada", "cultivada", "exotica", "desconhecida"];
var FASES_MUDA = ["semeadura", "germinacao", "repicagem", "crescimento", "rustificacao", "pronta"];
var SITUACOES_DOACAO = [
  "rascunho",
  "enviada",
  "em_analise",
  "aprovada",
  "aprovada_parcial",
  "negada",
  "aguardando_retirada",
  "retirada",
  "expirada",
  "cancelada"
];
var TODOS_EXCETO_SOLICITANTE = ["coletor", "viveirista", "gestor"];
var EQUIPE_VIVEIRO = ["viveirista", "gestor"];
var SO_GESTOR = ["gestor"];
var COLECOES = [
  // ---- organização --------------------------------------------------------
  {
    nome: "instalacao",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("nome_orgao", true), t("uf_padrao", true), arq("logotipo"), t("cabecalho_documentos"), t("texto_termo_doacao")],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  {
    nome: "viveiro",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("sigla", true), t("nome", true), r("municipio_id", "municipio"), t("endereco"), b("ativo")],
    indices: ["sigla"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  {
    nome: "municipio",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("codigo_ibge", true), t("nome", true), t("uf", true), o("biomas", BIOMAS, false, true), j("contorno")],
    indices: ["codigo_ibge", "uf"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  {
    nome: "usuario_viveiro",
    natureza: "cadastro",
    porViveiro: true,
    campos: [r("usuario_id", "users", true), o("perfil", ["coletor", "viveirista", "gestor"], true)],
    indices: ["usuario_id"],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR
  },
  {
    // Pedido de acesso de quem se cadastrou pelo celular como coletor ou viveirista.
    nome: "pedido_acesso",
    natureza: "cadastro",
    porViveiro: true,
    campos: [r("usuario_id", "users", true), t("nome"), t("email"), o("perfil", ["coletor", "viveirista"], true), o("situacao", ["pendente", "aprovado", "recusado"], true), r("analisado_por", "users"), t("motivo")],
    indices: ["usuario_id"],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR
  },
  {
    nome: "pessoa",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("nome", true), o("tipo", ["fisica", "juridica"]), t("instituicao"), r("municipio_id", "municipio"), r("usuario_id", "users")],
    indices: ["nome", "usuario_id"],
    leitura: "todos",
    escrita: ["coletor", "viveirista", "gestor", "solicitante"],
    campoDono: "usuario_id"
  },
  {
    // LGPD: CPF/CNPJ e telefone ficam aqui e só o gestor lê.
    nome: "dados_pessoais",
    natureza: "cadastro",
    porViveiro: false,
    campos: [r("pessoa_id", "pessoa", true), t("documento"), t("telefone"), t("email")],
    indices: ["pessoa_id"],
    leitura: SO_GESTOR,
    escrita: ["coletor", "viveirista", "gestor", "solicitante"]
  },
  {
    nome: "parametro",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("chave", true), j("valor"), r("viveiro_id", "viveiro"), t("descricao")],
    indices: ["chave"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  {
    nome: "meta",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("indicador", true), n("alvo", true), n("ano"), r("viveiro_id", "viveiro"), r("especie_id", "especie"), r("programa_id", "programa")],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  // ---- espécies e assistente ---------------------------------------------
  {
    nome: "especie",
    natureza: "cadastro",
    porViveiro: false,
    campos: [
      t("nome_cientifico", true),
      t("autor"),
      t("familia"),
      t("flora_id"),
      t("forma_vida"),
      b("endemica"),
      t("folha"),
      t("disposicao"),
      t("latex"),
      t("espinhos"),
      t("casca"),
      t("flor"),
      t("fruto"),
      j("meses_flor"),
      // lista de meses 1..12
      j("meses_fruto"),
      n("lorenzi_volume"),
      n("lorenzi_pagina"),
      // [hipótese] dados de sementes e mudas — ajustar pela tabela de sementes e mudas
      n("sementes_por_kg"),
      t("dormencia"),
      t("tratamento_pre_germinativo"),
      n("dias_germinacao"),
      n("meses_ate_pronta"),
      t("grupo_sucessional"),
      o("origem", ORIGENS_ESPECIE),
      b("ficticia"),
      b("publicada"),
      // importação: casos que a equipe precisa conferir (família conflitante, nome ambíguo…)
      b("revisar"),
      t("nota_revisao"),
      o("fonte_cadastro", ["planilha", "flora_funga", "manual"])
    ],
    indices: ["nome_cientifico", "familia", "flora_id"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  { nome: "sinonimo", natureza: "cadastro", porViveiro: false, campos: [r("especie_id", "especie", true), t("nome", true)], indices: ["especie_id", "nome"], leitura: "todos", escrita: SO_GESTOR },
  { nome: "nome_popular", natureza: "cadastro", porViveiro: false, campos: [r("especie_id", "especie", true), t("nome", true), t("nome_busca"), t("regiao")], indices: ["especie_id", "nome", "nome_busca"], leitura: "todos", escrita: SO_GESTOR },
  {
    nome: "especie_ocorrencia",
    natureza: "cadastro",
    porViveiro: false,
    campos: [r("especie_id", "especie", true), t("uf", true), o("bioma", BIOMAS), o("origem", ["flora_funga", "manual"])],
    indices: ["especie_id", "uf"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  { nome: "especie_municipio", natureza: "cadastro", porViveiro: false, campos: [r("especie_id", "especie", true), r("municipio_id", "municipio", true)], indices: ["especie_id", "municipio_id"], leitura: "todos", escrita: SO_GESTOR },
  { nome: "especie_confusao", natureza: "cadastro", porViveiro: false, campos: [r("especie_a_id", "especie", true), r("especie_b_id", "especie", true), t("como_diferenciar")], indices: ["especie_a_id", "especie_b_id"], leitura: "todos", escrita: SO_GESTOR },
  {
    nome: "especie_foto",
    natureza: "cadastro",
    porViveiro: false,
    publico: true,
    campos: [r("especie_id", "especie", true), o("parte", PARTES_PLANTA, true), arq("arquivo"), arq("miniatura"), t("credito"), t("licenca")],
    indices: ["especie_id"],
    leitura: "todos",
    escrita: SO_GESTOR
  },
  { nome: "pergunta", natureza: "cadastro", porViveiro: false, campos: [t("texto", true), t("chave"), o("parte", PARTES_PLANTA), n("ordem"), b("ativa")], indices: ["ordem", "chave"], leitura: "todos", escrita: SO_GESTOR },
  { nome: "opcao", natureza: "cadastro", porViveiro: false, campos: [r("pergunta_id", "pergunta", true), t("rotulo", true), t("chave"), arq("figura"), t("figura_padrao"), n("ordem")], indices: ["pergunta_id", "chave"], leitura: "todos", escrita: SO_GESTOR },
  { nome: "especie_opcao", natureza: "cadastro", porViveiro: false, campos: [r("especie_id", "especie", true), r("opcao_id", "opcao", true)], indices: ["especie_id", "opcao_id"], leitura: "todos", escrita: SO_GESTOR },
  // ---- módulo 1: matrizes -------------------------------------------------
  {
    nome: "matriz",
    natureza: "cadastro",
    porViveiro: true,
    prefixoCodigo: "MT",
    campos: [
      t("codigo", true),
      r("especie_id", "especie"),
      o("grau_certeza", GRAUS_CERTEZA, true),
      o("metodo_identificacao", ["assistente", "manual"]),
      j("respostas_assistente"),
      r("municipio_id", "municipio"),
      n("lat"),
      n("lon"),
      n("precisao_m"),
      n("altitude"),
      t("descricao_local"),
      r("proprietario_pessoa_id", "pessoa"),
      b("autorizacao_proprietario"),
      o("tipo_local", TIPOS_LOCAL_MATRIZ),
      n("dap_cm"),
      n("cap_cm"),
      n("altura_m"),
      o("estado_fitossanitario", ["bom", "regular", "ruim"]),
      o("situacao", ["ativa", "inativa", "morta"]),
      r("coletor_id", "users"),
      t("observacao"),
      // validação pelo gestor: só matriz aprovada vai para coleta
      o("situacao_validacao", SITUACOES_VALIDACAO),
      r("validado_por", "users"),
      d("validado_em"),
      t("nota_validacao")
    ],
    indices: ["codigo", "especie_id", "municipio_id", "situacao_validacao"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ["coletor", "gestor"]
  },
  {
    // Foto genérica (matriz, coleta, lote, retirada, monitoramento…).
    nome: "foto",
    natureza: "evento",
    porViveiro: true,
    campos: [t("entidade", true), t("registro_id", true), o("parte", PARTES_PLANTA), arq("arquivo"), arq("miniatura"), n("lat"), n("lon"), d("tirada_em")],
    indices: ["registro_id"],
    leitura: "todos",
    escrita: ["coletor", "viveirista", "gestor", "solicitante"],
    campoDono: "criado_por"
  },
  {
    nome: "sugestao_identificacao",
    natureza: "cadastro",
    porViveiro: true,
    campos: [r("matriz_id", "matriz", true), o("fonte", ["plantnet", "inaturalist"]), r("especie_id", "especie"), t("nome_sugerido"), n("pontuacao"), o("situacao", ["pendente", "aceita", "rejeitada"]), r("revisado_por", "users")],
    indices: ["matriz_id"],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR
  },
  {
    // Registro de fenologia a cada visita (calendário de frutificação).
    nome: "fenologia",
    natureza: "evento",
    porViveiro: true,
    campos: [r("matriz_id", "matriz", true), d("data", true), o("fases", FENOFASES, true, true), t("observacao")],
    indices: ["matriz_id", "data"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ["coletor", "viveirista", "gestor"]
  },
  { nome: "rota_campo", natureza: "cadastro", porViveiro: true, campos: [r("coletor_id", "users"), d("data"), j("matrizes_planejadas"), t("observacao")], leitura: TODOS_EXCETO_SOLICITANTE, escrita: ["coletor", "gestor"] },
  // ---- módulo 2: coleta e sementes ---------------------------------------
  {
    nome: "coleta",
    natureza: "cadastro",
    porViveiro: true,
    campos: [r("matriz_id", "matriz", true), d("data", true), r("coletor_id", "users"), o("material", ["fruto", "semente"]), n("quantidade"), o("unidade", ["g", "kg", "litros", "frutos", "unidades"]), n("lat"), n("lon"), t("observacao")],
    indices: ["matriz_id", "data"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: ["coletor", "viveirista", "gestor"]
  },
  {
    nome: "endereco_armazenamento",
    natureza: "cadastro",
    porViveiro: true,
    campos: [t("codigo", true), t("local"), t("estante"), t("prateleira"), t("caixa"), b("ativo")],
    indices: ["codigo"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  {
    nome: "lote_sementes",
    natureza: "cadastro",
    porViveiro: true,
    prefixoCodigo: "LS",
    campos: [
      t("codigo", true),
      r("especie_id", "especie", true),
      d("data_formacao"),
      n("peso_g"),
      n("sementes_estimadas"),
      n("umidade_pct"),
      n("germinacao_teste_pct"),
      r("endereco_id", "endereco_armazenamento"),
      d("validade"),
      o("situacao", ["armazenado", "em_uso", "esgotado", "descartado"]),
      t("observacao")
    ],
    indices: ["codigo", "especie_id"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  { nome: "lote_sementes_coleta", natureza: "cadastro", porViveiro: true, campos: [r("lote_sementes_id", "lote_sementes", true), r("coleta_id", "coleta", true), n("quantidade")], indices: ["lote_sementes_id", "coleta_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  {
    nome: "movimento_sementes",
    natureza: "evento",
    porViveiro: true,
    campos: [r("lote_sementes_id", "lote_sementes", true), o("tipo", ["entrada", "semeadura", "teste", "descarte", "mudanca_endereco", "ajuste"], true), n("quantidade_g"), n("quantidade_unid"), d("data", true), r("lote_mudas_id", "lote_mudas"), r("endereco_id", "endereco_armazenamento"), t("observacao")],
    indices: ["lote_sementes_id"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  // ---- módulo 3: viveiro --------------------------------------------------
  {
    nome: "lote_mudas",
    natureza: "cadastro",
    porViveiro: true,
    prefixoCodigo: "LM",
    // origem "estoque_inicial": mudas que já estavam no viveiro antes do app (sem lote de sementes).
    campos: [t("codigo", true), o("origem", ["semeadura", "estoque_inicial"]), r("lote_sementes_id", "lote_sementes"), t("observacao_origem"), r("especie_id", "especie", true), d("data_semeadura"), n("sementes_semeadas"), n("sementes_semeadas_g"), o("recipiente", RECIPIENTES), t("canteiro"), o("fase_atual", FASES_MUDA), o("situacao", ["ativo", "encerrado"])],
    indices: ["codigo", "lote_sementes_id", "especie_id", "fase_atual"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  {
    nome: "evento_lote_mudas",
    natureza: "evento",
    porViveiro: true,
    campos: [r("lote_mudas_id", "lote_mudas", true), o("tipo", ["semeadura", "contagem_germinacao", "repicagem", "mudanca_fase", "medicao", "perda", "transferencia"], true), d("data", true), n("quantidade"), t("causa"), n("altura_media_cm"), o("fase_nova", FASES_MUDA), t("observacao")],
    indices: ["lote_mudas_id", "tipo"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  {
    // Livro-razão do estoque de mudas: o saldo é sempre a soma dos movimentos.
    nome: "movimento_estoque_mudas",
    natureza: "evento",
    porViveiro: true,
    campos: [r("lote_mudas_id", "lote_mudas", true), o("tipo", ["entrada", "perda", "ajuste_inventario", "saida_doacao", "transferencia"], true), n("quantidade", true), d("data", true), t("referencia")],
    indices: ["lote_mudas_id"],
    leitura: TODOS_EXCETO_SOLICITANTE,
    escrita: EQUIPE_VIVEIRO
  },
  { nome: "inventario", natureza: "cadastro", porViveiro: true, campos: [d("data", true), r("responsavel_id", "users"), o("situacao", ["aberto", "fechado"])], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: "inventario_item", natureza: "cadastro", porViveiro: true, campos: [r("inventario_id", "inventario", true), r("lote_mudas_id", "lote_mudas", true), n("contado"), n("saldo_sistema")], indices: ["inventario_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  // ---- módulo 5: doação ---------------------------------------------------
  {
    nome: "doacao",
    natureza: "cadastro",
    porViveiro: true,
    prefixoCodigo: "DO",
    campoDono: "solicitante_usuario_id",
    campos: [
      t("codigo", true),
      r("solicitante_pessoa_id", "pessoa", true),
      r("solicitante_usuario_id", "users"),
      t("instituicao"),
      t("finalidade"),
      r("municipio_plantio_id", "municipio"),
      t("local_plantio"),
      j("geometria_plantio"),
      n("area_ha"),
      o("canal", ["online", "balcao"]),
      arq("oficio"),
      o("situacao", SITUACOES_DOACAO, true),
      r("analisado_por", "users"),
      d("analisado_em"),
      t("justificativa"),
      d("retirar_ate")
    ],
    indices: ["codigo", "situacao", "solicitante_usuario_id"],
    leitura: "todos",
    escrita: ["viveirista", "gestor", "solicitante"]
  },
  { nome: "doacao_item", natureza: "cadastro", porViveiro: true, campoDono: "solicitante_usuario_id", campos: [r("doacao_id", "doacao", true), r("especie_id", "especie", true), n("qtd_pedida"), n("qtd_aprovada"), n("qtd_entregue"), r("solicitante_usuario_id", "users")], indices: ["doacao_id"], leitura: "todos", escrita: ["viveirista", "gestor", "solicitante"] },
  { nome: "reserva", natureza: "cadastro", porViveiro: true, campos: [r("doacao_item_id", "doacao_item", true), r("lote_mudas_id", "lote_mudas", true), n("quantidade", true), d("valida_ate"), o("situacao", ["ativa", "consumida", "expirada", "cancelada"], true)], indices: ["doacao_item_id", "lote_mudas_id", "situacao"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: "doacao_item_lote", natureza: "evento", porViveiro: true, campos: [r("doacao_item_id", "doacao_item", true), r("lote_mudas_id", "lote_mudas", true), n("quantidade", true)], indices: ["doacao_item_id", "lote_mudas_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: "retirada", natureza: "cadastro", porViveiro: true, campos: [r("doacao_id", "doacao", true), d("data", true), t("recebedor_nome"), r("recebedor_pessoa_id", "pessoa"), arq("assinatura"), arq("termo_pdf"), r("entregue_por", "users")], indices: ["doacao_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: "programa", natureza: "cadastro", porViveiro: false, campos: [t("nome", true), t("icone"), t("cor"), b("ativo")], leitura: "todos", escrita: SO_GESTOR },
  { nome: "doacao_programa", natureza: "cadastro", porViveiro: true, campos: [r("doacao_id", "doacao", true), r("programa_id", "programa", true), b("ativo")], indices: ["doacao_id", "programa_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  { nome: "doacao_programa_historico", natureza: "evento", porViveiro: true, campos: [r("doacao_id", "doacao", true), r("programa_id", "programa", true), o("acao", ["marcou", "desmarcou"], true), t("motivo"), t("usuario_nome")], indices: ["doacao_id"], leitura: TODOS_EXCETO_SOLICITANTE, escrita: EQUIPE_VIVEIRO },
  // ---- módulo 6: pós-plantio ---------------------------------------------
  { nome: "plantio", natureza: "cadastro", porViveiro: true, campoDono: "solicitante_usuario_id", campos: [r("doacao_id", "doacao", true), d("data"), j("geometria"), r("municipio_id", "municipio"), t("local"), t("responsavel"), r("solicitante_usuario_id", "users")], indices: ["doacao_id"], leitura: "todos", escrita: ["viveirista", "gestor", "solicitante"] },
  { nome: "plantio_item", natureza: "cadastro", porViveiro: true, campoDono: "solicitante_usuario_id", campos: [r("plantio_id", "plantio", true), r("especie_id", "especie", true), n("quantidade"), r("solicitante_usuario_id", "users")], indices: ["plantio_id"], leitura: "todos", escrita: ["viveirista", "gestor", "solicitante"] },
  { nome: "monitoramento", natureza: "cadastro", porViveiro: true, campoDono: "solicitante_usuario_id", campos: [r("plantio_id", "plantio", true), d("data", true), o("tipo", ["relato", "vistoria"], true), r("validado_por", "users"), t("observacao"), r("solicitante_usuario_id", "users")], indices: ["plantio_id"], leitura: "todos", escrita: ["viveirista", "gestor", "solicitante"] },
  { nome: "monitoramento_item", natureza: "cadastro", porViveiro: true, campoDono: "solicitante_usuario_id", campos: [r("monitoramento_id", "monitoramento", true), r("especie_id", "especie", true), n("plantadas"), n("vivas"), r("solicitante_usuario_id", "users")], indices: ["monitoramento_id"], leitura: "todos", escrita: ["viveirista", "gestor", "solicitante"] },
  // ---- módulo 7 e controle -----------------------------------------------
  { nome: "publicacao", natureza: "cadastro", porViveiro: false, campos: [t("titulo", true), d("data"), j("conteudo"), b("publicada")], leitura: SO_GESTOR, escrita: SO_GESTOR },
  {
    // Criado pelo servidor quando o mesmo campo mudou no aparelho e no servidor.
    nome: "conflito",
    natureza: "cadastro",
    porViveiro: false,
    campos: [t("colecao", true), t("registro_id", true), j("campos"), r("usuario_id", "users"), o("situacao", ["aberto", "resolvido"], true), r("resolvido_por", "users")],
    indices: ["registro_id", "situacao"],
    leitura: SO_GESTOR,
    escrita: SO_GESTOR
  }
];
var POR_NOME = new Map(COLECOES.map((c) => [c.nome, c]));
function colecao(nome) {
  const c = POR_NOME.get(nome);
  if (!c) throw new Error(`Cole\xE7\xE3o desconhecida: ${nome}`);
  return c;
}
function existeColecao(nome) {
  return POR_NOME.has(nome);
}
function nomesCampos(c) {
  const nomes = c.campos.map((f) => f.nome);
  if (c.porViveiro) nomes.push("viveiro_id");
  return nomes;
}
var PARAMETROS_PADRAO = {
  meta_matrizes_por_especie: { valor: 12, descricao: "Meta de matrizes por esp\xE9cie" },
  min_matrizes_por_lote: { valor: 12, descricao: "M\xEDnimo de matrizes num lote de sementes antes do alerta de diversidade" },
  distancia_min_matrizes_m: { valor: 100, descricao: "Dist\xE2ncia m\xEDnima entre matrizes da mesma esp\xE9cie (metros)" },
  prazo_retirada_dias: { valor: 30, descricao: "Dias para retirar as mudas depois da aprova\xE7\xE3o" },
  limite_mudas_por_pedido: { valor: 1e3, descricao: "M\xE1ximo de mudas num pedido" },
  perfis_aprovadores: { valor: ["gestor"], descricao: "Perfis que podem aprovar doa\xE7\xF5es" },
  dias_sessao_offline: { valor: 30, descricao: "Dias que o aparelho pode ficar sem entrar na internet antes de pedir login de novo" },
  fotos_obrigatorias_matriz: { valor: ["arvore", "folha"], descricao: "Fotos que o coletor precisa tirar para salvar a matriz" },
  precisao_gps_maxima_m: { valor: 30, descricao: "Precis\xE3o do GPS (metros) a partir da qual o app aceita o ponto sem perguntar" },
  aviso_validade_sementes_dias: { valor: 60, descricao: "Avisar quando faltar este n\xFAmero de dias para a validade de um lote de sementes" },
  distancia_max_foto_plantio_m: { valor: 500, descricao: "Fotos do plantio mais longe que isto (metros) ficam marcadas para confer\xEAncia" },
  tamanho_faixa_codigos: { valor: 20, descricao: "Quantos c\xF3digos cada aparelho reserva por tipo no pacote de campo" }
};

// ../dominio/src/codigos.ts
var TIPOS_COM_ANO = /* @__PURE__ */ new Set(["LS", "DO"]);
var pad = (n2, tam) => String(n2).padStart(tam, "0");
function codigoMatriz(numero) {
  return `MT-${pad(numero, 4)}`;
}
function codigoLoteSementes(ano, numero) {
  return `LS-${ano}-${pad(numero, 3)}`;
}
function codigoDoacao(ano, numero) {
  return `DO-${ano}-${pad(numero, 3)}`;
}
function formatarCodigo(tipo, ano, numero) {
  if (tipo === "MT") return codigoMatriz(numero);
  if (tipo === "LS") return codigoLoteSementes(ano, numero);
  return codigoDoacao(ano, numero);
}
function letraDoIndice(indice) {
  let s = "";
  let i = indice;
  do {
    s = String.fromCharCode(65 + i % 26) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}
function indiceDaLetra(letra) {
  let i = 0;
  for (const ch of letra) i = i * 26 + (ch.charCodeAt(0) - 64);
  return i - 1;
}
function codigoLoteMudas(codigoLS, indice) {
  const ls = lerCodigo(codigoLS);
  if (!ls || ls.tipo !== "LS") throw new Error(`C\xF3digo de lote de sementes inv\xE1lido: ${codigoLS}`);
  return `LM-${ls.ano}-${pad(ls.numero, 3)}-${letraDoIndice(indice)}`;
}
function proximoCodigoLoteMudas(codigoLS, existentes) {
  const ls = lerCodigo(codigoLS);
  if (!ls || ls.tipo !== "LS") throw new Error(`C\xF3digo de lote de sementes inv\xE1lido: ${codigoLS}`);
  if (ls.provisorio) throw new Error("Lote de sementes com c\xF3digo provis\xF3rio: use um c\xF3digo provis\xF3rio para o lote de mudas.");
  let maior = -1;
  for (const c of existentes) {
    const lm = lerCodigo(c);
    if (lm && lm.tipo === "LM" && !lm.inicial && lm.ano === ls.ano && lm.numero === ls.numero) maior = Math.max(maior, indiceDaLetra(lm.letra));
  }
  return codigoLoteMudas(codigoLS, maior + 1);
}
function codigoEstoqueInicial(ano, numero) {
  return `LM-${ano}-I-${pad(numero, 3)}`;
}
function proximoCodigoEstoqueInicial(ano, existentes) {
  let maior = 0;
  for (const c of existentes) {
    const lm = lerCodigo(c);
    if ((lm == null ? void 0 : lm.inicial) && lm.ano === ano) maior = Math.max(maior, lm.numero);
  }
  return codigoEstoqueInicial(ano, maior + 1);
}
function lerCodigo(codigo) {
  const s = codigo.trim().toUpperCase();
  let m = /^MT-(\d{4,})$/.exec(s);
  if (m) return { tipo: "MT", ano: 0, numero: Number(m[1]), provisorio: false };
  m = /^(LS|DO)-(\d{4})-(\d{3,})$/.exec(s);
  if (m) return { tipo: m[1], ano: Number(m[2]), numero: Number(m[3]), provisorio: false };
  m = /^LM-(\d{4})-I-(\d{3,})$/.exec(s);
  if (m) return { tipo: "LM", ano: Number(m[1]), numero: Number(m[2]), provisorio: false, inicial: true };
  m = /^LM-(\d{4})-(\d{3,})-([A-Z]+)$/.exec(s);
  if (m) return { tipo: "LM", ano: Number(m[1]), numero: Number(m[2]), letra: m[3], provisorio: false };
  m = /^(MT|LS|DO|LM)-P-([A-Z0-9]+)-(\d+)$/.exec(s);
  if (m) return { tipo: m[1], ano: 0, numero: Number(m[3]), provisorio: true };
  return null;
}
function ehProvisorio(codigo) {
  var _a;
  return ((_a = lerCodigo(codigo)) == null ? void 0 : _a.provisorio) === true;
}

// ../dominio/src/permissoes.ts
var FUNCIONALIDADES = [
  { chave: "cadastrar_matriz", grupo: "Matrizes", rotulo: "Cadastrar matriz e rota de campo", padrao: ["coletor", "gestor"], escrita: ["matriz", "rota_campo"] },
  { chave: "fenologia", grupo: "Matrizes", rotulo: "Registrar flor e fruto", padrao: ["coletor", "viveirista", "gestor"], escrita: ["fenologia"] },
  { chave: "validar_matriz", grupo: "Matrizes", rotulo: "Aprovar matriz para coleta", padrao: ["gestor"] },
  { chave: "registrar_coleta", grupo: "Coleta e sementes", rotulo: "Registrar coleta de sementes", padrao: ["coletor", "viveirista", "gestor"], escrita: ["coleta"] },
  { chave: "lotes_sementes", grupo: "Coleta e sementes", rotulo: "Formar lotes e guardar sementes", padrao: ["viveirista", "gestor"], escrita: ["lote_sementes", "lote_sementes_coleta", "movimento_sementes", "endereco_armazenamento"] },
  { chave: "producao", grupo: "Viveiro", rotulo: "Semear e cuidar das mudas", padrao: ["viveirista", "gestor"], escrita: ["lote_mudas", "evento_lote_mudas", "movimento_estoque_mudas"] },
  { chave: "estoque_inicial", grupo: "Viveiro", rotulo: "Cadastrar mudas que j\xE1 estavam no viveiro", padrao: ["viveirista", "gestor"], escrita: ["lote_mudas", "movimento_estoque_mudas"] },
  { chave: "inventario", grupo: "Viveiro", rotulo: "Fazer invent\xE1rio", padrao: ["viveirista", "gestor"], escrita: ["inventario", "inventario_item"] },
  { chave: "pedir_mudas", grupo: "Doa\xE7\xE3o de mudas", rotulo: "Pedir mudas", padrao: ["viveirista", "gestor", "solicitante"], escrita: ["doacao", "doacao_item"], solicitantePode: true },
  { chave: "aprovar_doacao", grupo: "Doa\xE7\xE3o de mudas", rotulo: "Aprovar pedidos de mudas", padrao: ["gestor"] },
  { chave: "retirada", grupo: "Doa\xE7\xE3o de mudas", rotulo: "Entregar mudas (retirada)", padrao: ["viveirista", "gestor"], escrita: ["retirada", "reserva", "doacao_item_lote"] },
  { chave: "plantando_agua", grupo: "Doa\xE7\xE3o de mudas", rotulo: "Marcar Plantando \xC1gua", padrao: ["viveirista", "gestor"], escrita: ["doacao_programa", "doacao_programa_historico"] },
  { chave: "registrar_plantio", grupo: "P\xF3s-plantio", rotulo: "Registrar plantio e acompanhamento", padrao: ["viveirista", "gestor", "solicitante"], escrita: ["plantio", "plantio_item", "monitoramento", "monitoramento_item"], solicitantePode: true },
  { chave: "vistoria", grupo: "P\xF3s-plantio", rotulo: "Fazer vistoria t\xE9cnica", padrao: ["viveirista", "gestor"] },
  { chave: "especies", grupo: "Esp\xE9cies", rotulo: "Editar e importar esp\xE9cies", padrao: ["gestor"], escrita: ["especie", "sinonimo", "nome_popular", "especie_ocorrencia", "especie_municipio", "especie_confusao", "especie_foto", "pergunta", "opcao", "especie_opcao"] },
  { chave: "relatorios", grupo: "Relat\xF3rios", rotulo: "Ver relat\xF3rios e baixar planilhas", padrao: ["gestor"] },
  { chave: "dados_pessoais", grupo: "Relat\xF3rios", rotulo: "Ver CPF e telefone (LGPD)", padrao: ["gestor"], fixa: true },
  { chave: "viveiros", grupo: "Gest\xE3o", rotulo: "Cadastrar viveiros e munic\xEDpios", padrao: ["gestor"], escrita: ["viveiro", "municipio"] },
  { chave: "equipe", grupo: "Gest\xE3o", rotulo: "Cadastrar equipe e aprovar acessos", padrao: ["gestor"], escrita: ["usuario_viveiro", "pedido_acesso"] },
  { chave: "parametros", grupo: "Gest\xE3o", rotulo: "Ajustar par\xE2metros e metas", padrao: ["gestor"], escrita: ["parametro", "meta", "programa"] },
  { chave: "permissoes", grupo: "Gest\xE3o", rotulo: "Mudar esta tabela de permiss\xF5es", padrao: [], soAdministrador: true }
];
var ORDEM = ["coletor", "viveirista", "gestor", "solicitante"];
var ordenar = (ps) => ORDEM.filter((p) => new Set(ps).has(p));
var POR_CHAVE = new Map(FUNCIONALIDADES.map((f) => [f.chave, f]));
function celulaEditavel(f, perfil) {
  if (f.fixa || f.soAdministrador) return false;
  if (perfil === "solicitante") return !!f.solicitantePode;
  return true;
}
function matrizPadrao() {
  return Object.fromEntries(FUNCIONALIDADES.map((f) => [f.chave, ordenar(f.padrao)]));
}
function normalizarMatriz(m) {
  const out = {};
  for (const f of FUNCIONALIDADES) {
    const marcados = new Set(Array.isArray(m == null ? void 0 : m[f.chave]) ? m[f.chave] : f.padrao);
    out[f.chave] = ordenar(ORDEM.filter((p) => celulaEditavel(f, p) ? marcados.has(p) : f.padrao.includes(p)));
  }
  return out;
}
function matrizDe(parametros) {
  const p = parametros.find((x) => x.chave === "permissoes" && !x.excluido && !x.viveiro_id);
  const salvo = (p == null ? void 0 : p.valor) && typeof p.valor === "object" ? p.valor : {};
  if (!salvo.aprovar_doacao) {
    const ap = parametros.find((x) => x.chave === "perfis_aprovadores" && !x.excluido && !x.viveiro_id);
    if (Array.isArray(ap == null ? void 0 : ap.valor)) salvo.aprovar_doacao = ap.valor;
  }
  return normalizarMatriz(salvo);
}
function escritaEfetiva(col, m) {
  if (!m) return col.escrita;
  const cobrem = FUNCIONALIDADES.filter((f) => {
    var _a;
    return (_a = f.escrita) == null ? void 0 : _a.includes(col.nome);
  });
  if (!cobrem.length) return col.escrita;
  const dosPadroes = new Set(cobrem.flatMap((f) => f.padrao));
  const fixos = col.escrita.filter((p) => !dosPadroes.has(p));
  return ordenar([...fixos, ...cobrem.flatMap((f) => {
    var _a;
    return (_a = m[f.chave]) != null ? _a : f.padrao;
  })]);
}
function perfisComPermissao(m, chave) {
  var _a, _b, _c;
  return (_c = (_b = (m != null ? m : matrizPadrao())[chave]) != null ? _b : (_a = POR_CHAVE.get(chave)) == null ? void 0 : _a.padrao) != null ? _c : [];
}
function temPermissao(ctx, chave, viveiroId) {
  var _a;
  if (ctx.gestorGeral) return true;
  const f = POR_CHAVE.get(chave);
  if (!f || f.soAdministrador) return false;
  const permitidos = new Set(perfisComPermissao(ctx.permissoes, chave));
  if (ctx.solicitante && permitidos.has("solicitante")) return true;
  const listas = typeof viveiroId === "string" && viveiroId ? [(_a = ctx.perfisPorViveiro[viveiroId]) != null ? _a : []] : Object.values(ctx.perfisPorViveiro);
  return listas.some((ps) => ps.some((p) => permitidos.has(p)));
}

// ../dominio/src/acesso.ts
function perfisPara(ctx, viveiroId) {
  var _a;
  const s = /* @__PURE__ */ new Set();
  if (ctx.gestorGeral) s.add("gestor");
  if (ctx.solicitante) s.add("solicitante");
  if (typeof viveiroId === "string" && viveiroId) {
    for (const p of (_a = ctx.perfisPorViveiro[viveiroId]) != null ? _a : []) s.add(p);
  } else {
    for (const ps of Object.values(ctx.perfisPorViveiro)) for (const p of ps) s.add(p);
  }
  return s;
}
function viveirosVisiveis(ctx) {
  return ctx.gestorGeral ? null : Object.keys(ctx.perfisPorViveiro);
}
function viaDono(col, perfis, permitidos) {
  for (const p of perfis) if (p !== "solicitante" && permitidos.includes(p)) return false;
  return perfis.has("solicitante") && permitidos.includes("solicitante") && !!col.campoDono;
}
function podeLer(ctx, col, reg) {
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : void 0);
  if (col.leitura === "todos") {
    if (col.campoDono && perfis.size === 1 && perfis.has("solicitante")) return reg[col.campoDono] === ctx.id;
    if (col.porViveiro && !perfis.size) return false;
    return perfis.size > 0 || !col.porViveiro;
  }
  if (viaDono(col, perfis, col.leitura)) return reg[col.campoDono] === ctx.id;
  for (const p of perfis) if (col.leitura.includes(p)) return true;
  return false;
}
function podeEscrever(ctx, col, reg) {
  if (ctx.gestorGeral) return true;
  const escrita = escritaEfetiva(col, ctx.permissoes);
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : void 0);
  if (viaDono(col, perfis, escrita)) return reg[col.campoDono] === ctx.id;
  for (const p of perfis) if (escrita.includes(p)) return true;
  return false;
}
function escreveComoSolicitante(ctx, col, reg) {
  if (ctx.gestorGeral) return false;
  const perfis = perfisPara(ctx, col.porViveiro ? reg.viveiro_id : void 0);
  return viaDono(col, perfis, escritaEfetiva(col, ctx.permissoes));
}

// ../dominio/src/sync/valores.ts
function vazio(v) {
  return v === null || v === void 0 || v === "" || v === 0 || v === false || Array.isArray(v) && v.length === 0;
}
function iguais(a, b2) {
  if (vazio(a) && vazio(b2)) return true;
  if (a === b2) return true;
  if (typeof a === "object" && typeof b2 === "object" && a && b2) return JSON.stringify(ordenar2(a)) === JSON.stringify(ordenar2(b2));
  return false;
}
function ordenar2(v) {
  if (Array.isArray(v)) return v.map(ordenar2);
  if (v && typeof v === "object") {
    const o2 = {};
    for (const k of Object.keys(v).sort()) o2[k] = ordenar2(v[k]);
    return o2;
  }
  return v;
}

// ../dominio/src/regras-escrita.ts
var SITUACOES_SO_SERVIDOR = ["aprovada", "aprovada_parcial", "negada", "expirada"];
var CAMPOS_ANALISE = ["analisado_por", "analisado_em", "justificativa", "retirar_ate"];
var mudou = (antes, depois, campo) => (antes ? antes[campo] : void 0) !== depois[campo] && !(antes === null && (depois[campo] === void 0 || depois[campo] === null || depois[campo] === ""));
function soSolicitante(ctx, reg) {
  const p = perfisPara(ctx, reg.viveiro_id);
  return p.has("solicitante") && !p.has("viveirista") && !p.has("gestor") && !p.has("coletor");
}
function violacaoRegra(col, antes, depois, ctx) {
  if (col.nome === "matriz" && mudou(antes, depois, "situacao_validacao") && !(antes === null && depois.situacao_validacao === "pendente")) {
    if (!temPermissao(ctx, "validar_matriz", depois.viveiro_id)) return "Voc\xEA n\xE3o tem permiss\xE3o para aprovar matrizes.";
  }
  if (col.nome === "monitoramento" && depois.tipo === "vistoria" && mudou(antes, depois, "tipo")) {
    if (!temPermissao(ctx, "vistoria", depois.viveiro_id)) return "Voc\xEA n\xE3o tem permiss\xE3o para registrar vistoria.";
  }
  if (col.nome === "lote_mudas" && !antes) {
    if (depois.origem === "estoque_inicial") {
      if (!temPermissao(ctx, "estoque_inicial", depois.viveiro_id)) return "Voc\xEA n\xE3o tem permiss\xE3o para cadastrar mudas que j\xE1 estavam no viveiro.";
    } else if (!depois.lote_sementes_id) {
      return "Informe o lote de sementes da semeadura.";
    }
  }
  if (col.nome === "parametro" && (depois.chave === "permissoes" || (antes == null ? void 0 : antes.chave) === "permissoes") && !ctx.gestorGeral) {
    return "S\xF3 o administrador muda a tabela de permiss\xF5es.";
  }
  if (col.nome === "doacao") {
    if (mudou(antes, depois, "situacao") && SITUACOES_SO_SERVIDOR.includes(String(depois.situacao))) {
      return "A aprova\xE7\xE3o do pedido \xE9 feita com internet, para reservar as mudas no servidor.";
    }
    if (soSolicitante(ctx, depois)) {
      if (CAMPOS_ANALISE.some((c) => mudou(antes, depois, c))) return "O solicitante n\xE3o altera a an\xE1lise do pedido.";
      if (mudou(antes, depois, "situacao") && !["rascunho", "enviada", "cancelada"].includes(String(depois.situacao))) return "O solicitante s\xF3 envia ou cancela o pedido.";
      if (antes && !["rascunho", "enviada"].includes(String(antes.situacao)) && depois.situacao !== "cancelada") return "O pedido j\xE1 foi analisado e n\xE3o pode ser mudado pelo solicitante.";
    }
    if (antes && mudou(antes, depois, "situacao") && depois.situacao === "retirada" && !["aprovada", "aprovada_parcial"].includes(String(antes.situacao))) {
      return "S\xF3 pedidos aprovados podem ser retirados.";
    }
  }
  if (col.nome === "doacao_item") {
    if (mudou(antes, depois, "qtd_aprovada")) return "A quantidade aprovada \xE9 definida na an\xE1lise do pedido (com internet).";
    if (soSolicitante(ctx, depois) && mudou(antes, depois, "qtd_entregue")) return "A entrega \xE9 registrada pelo viveiro.";
  }
  if (col.nome === "reserva") {
    if (!antes) return "Reservas s\xE3o criadas pelo servidor ao aprovar o pedido.";
    if (mudou(antes, depois, "quantidade") || mudou(antes, depois, "lote_mudas_id")) return "A reserva n\xE3o pode ser alterada.";
    if (mudou(antes, depois, "situacao") && !(antes.situacao === "ativa" && ["consumida", "cancelada"].includes(String(depois.situacao)))) {
      return "A reserva s\xF3 pode ser consumida (retirada) ou cancelada.";
    }
  }
  return null;
}

// ../dominio/src/sync/resolver.ts
function resultado(op, status, extra = {}) {
  return __spreadValues({ op_id: op.op_id, colecao: op.colecao, registro_id: op.registro_id, status }, extra);
}
function rejeitar(op, motivo, atual) {
  return { gravar: null, resultado: resultado(op, "rejeitada", { motivo, registro: atual != null ? atual : void 0 }), auditoria: null, conflitos: [] };
}
function valorValido(c, v) {
  if (v === null || v === void 0) return true;
  switch (c.tipo) {
    case "texto":
    case "data":
    case "ref":
      return typeof v === "string";
    case "numero":
      return typeof v === "number" && Number.isFinite(v);
    case "bool":
      return typeof v === "boolean";
    case "opcao":
      if (c.multiplo) return Array.isArray(v) && v.every((x) => c.opcoes.includes(x));
      return v === "" || c.opcoes.includes(v);
    case "json":
      return true;
    case "arquivo":
      return false;
  }
}
function limparDados(col, dados) {
  const permitidos = new Map(col.campos.map((c) => [c.nome, c]));
  if (col.porViveiro) permitidos.set("viveiro_id", { nome: "viveiro_id", tipo: "ref", ref: "viveiro", obrigatorio: true });
  const limpos = {};
  const erros = [];
  for (const [k, v] of Object.entries(dados)) {
    const c = permitidos.get(k);
    if (!c) continue;
    if (c.tipo === "arquivo") continue;
    if (!valorValido(c, v)) erros.push(`valor inv\xE1lido em ${k}`);
    else limpos[k] = v;
  }
  return { limpos, erros };
}
function faltando(col, reg) {
  const obrig = col.campos.filter((c) => c.obrigatorio && c.tipo !== "arquivo").map((c) => c.nome);
  if (col.porViveiro) obrig.push("viveiro_id");
  return obrig.filter((k) => reg[k] === void 0 || reg[k] === null || reg[k] === "" || Array.isArray(reg[k]) && !reg[k].length);
}
function ajustarCodigo(col, reg, porta2) {
  if (!col.prefixoCodigo || typeof reg.codigo !== "string") return void 0;
  const codigo = reg.codigo;
  if (!ehProvisorio(codigo) && !porta2.codigoEmUso(col.nome, codigo, reg.id)) return void 0;
  const novo = porta2.novoCodigo(col, reg);
  reg.codigo = novo;
  return { de: codigo, para: novo };
}
function resolverOperacao(op, atual, ctx, porta2) {
  var _a, _b;
  if (!existeColecao(op.colecao)) return rejeitar(op, `cole\xE7\xE3o desconhecida: ${op.colecao}`);
  const col = colecao(op.colecao);
  if (op.tipo === "excluir") return excluir(op, col, atual, ctx);
  const { limpos, erros } = limparDados(col, (_a = op.dados) != null ? _a : {});
  if (erros.length) return rejeitar(op, erros.join("; "), atual);
  if (op.tipo === "criar" && !atual) return criar(op, col, limpos, ctx, porta2);
  if (!atual) return rejeitar(op, "registro n\xE3o existe no servidor");
  if (atual.excluido) return rejeitar(op, "registro foi exclu\xEDdo", atual);
  if (col.natureza === "evento") {
    if (op.tipo === "criar" && Object.entries(limpos).every(([k, v]) => iguais(atual[k], v))) {
      return { gravar: null, resultado: resultado(op, "aplicada", { registro: atual }), auditoria: null, conflitos: [] };
    }
    return rejeitar(op, "eventos n\xE3o podem ser alterados; registre um novo evento de corre\xE7\xE3o", atual);
  }
  const base = op.tipo === "criar" ? {} : (_b = op.base) != null ? _b : {};
  const baseVersao = op.tipo === "criar" ? -1 : op.base_versao;
  return alterar(op, col, atual, limpos, base, baseVersao, ctx);
}
function criar(op, col, limpos, ctx, porta2) {
  const reg = __spreadProps(__spreadValues({}, limpos), {
    id: op.registro_id,
    versao: 1,
    excluido: false,
    criado_por: ctx.id,
    atualizado_por: ctx.id,
    dispositivo_id: op.dispositivo_id,
    criado_no_aparelho_em: op.criado_no_aparelho_em
  });
  if (col.campoDono && col.campoDono !== "criado_por" && escreveComoSolicitante(ctx, col, __spreadProps(__spreadValues({}, reg), { [col.campoDono]: ctx.id }))) {
    reg[col.campoDono] = ctx.id;
  }
  const falta = faltando(col, reg);
  if (falta.length) return rejeitar(op, `faltam campos obrigat\xF3rios: ${falta.join(", ")}`);
  if (!podeEscrever(ctx, col, reg)) return rejeitar(op, "sem permiss\xE3o para criar este registro");
  const regraCriar = violacaoRegra(col, null, reg, ctx);
  if (regraCriar) return rejeitar(op, regraCriar);
  const codigo_alterado = ajustarCodigo(col, reg, porta2);
  return {
    gravar: reg,
    resultado: resultado(op, "aplicada", { registro: reg, codigo_alterado }),
    auditoria: { acao: "criar", antes: null, depois: __spreadValues(__spreadValues({}, limpos), codigo_alterado ? { codigo: reg.codigo } : {}) },
    conflitos: []
  };
}
function alterar(op, col, atual, limpos, base, baseVersao, ctx) {
  if (!podeEscrever(ctx, col, atual)) return rejeitar(op, "sem permiss\xE3o para alterar este registro", atual);
  const aplicar = {};
  const conflitos = [];
  const semMudancaNoServidor = atual.versao === baseVersao;
  for (const [campo, novo2] of Object.entries(limpos)) {
    const servidor = atual[campo];
    if (iguais(servidor, novo2)) continue;
    if (semMudancaNoServidor || campo in base && iguais(servidor, base[campo])) {
      aplicar[campo] = novo2;
    } else {
      conflitos.push({ campo, valor_base: base[campo], valor_aparelho: novo2, valor_servidor: servidor });
    }
  }
  if (!Object.keys(aplicar).length) {
    return {
      gravar: null,
      resultado: resultado(op, conflitos.length ? "conflito" : "aplicada", { registro: atual, conflitos: conflitos.length ? conflitos : void 0 }),
      auditoria: null,
      conflitos
    };
  }
  const novo = __spreadProps(__spreadValues(__spreadValues({}, atual), aplicar), { versao: atual.versao + 1, atualizado_por: ctx.id });
  if (col.campoDono && col.campoDono !== "criado_por" && !iguais(atual[col.campoDono], novo[col.campoDono]) && escreveComoSolicitante(ctx, col, atual)) {
    return rejeitar(op, "o solicitante n\xE3o pode trocar o dono do registro", atual);
  }
  if (!podeEscrever(ctx, col, novo)) return rejeitar(op, "sem permiss\xE3o para gravar nesse viveiro", atual);
  const regra = violacaoRegra(col, atual, novo, ctx);
  if (regra) return rejeitar(op, regra, atual);
  const falta = faltando(col, novo);
  if (falta.length) return rejeitar(op, `faltam campos obrigat\xF3rios: ${falta.join(", ")}`, atual);
  const antes = {};
  for (const k of Object.keys(aplicar)) antes[k] = atual[k];
  return {
    gravar: novo,
    resultado: resultado(op, conflitos.length ? "conflito" : "aplicada", { registro: novo, conflitos: conflitos.length ? conflitos : void 0 }),
    auditoria: { acao: "alterar", antes, depois: aplicar },
    conflitos
  };
}
function excluir(op, col, atual, ctx) {
  if (!atual || atual.excluido) return { gravar: null, resultado: resultado(op, "aplicada", { registro: atual != null ? atual : void 0 }), auditoria: null, conflitos: [] };
  if (col.natureza === "evento") return rejeitar(op, "eventos n\xE3o podem ser exclu\xEDdos; registre um evento de corre\xE7\xE3o", atual);
  if (!podeEscrever(ctx, col, atual)) return rejeitar(op, "sem permiss\xE3o para excluir este registro", atual);
  if (atual.versao !== op.base_versao) {
    const conflitos = [{ campo: "(exclus\xE3o)", valor_base: op.base_versao, valor_aparelho: "excluir", valor_servidor: atual.versao }];
    return {
      gravar: null,
      resultado: resultado(op, "conflito", { registro: atual, conflitos, motivo: "o registro foi alterado por outra pessoa; a exclus\xE3o n\xE3o foi feita" }),
      auditoria: null,
      conflitos
    };
  }
  const novo = __spreadProps(__spreadValues({}, atual), { excluido: true, versao: atual.versao + 1, atualizado_por: ctx.id });
  return {
    gravar: novo,
    resultado: resultado(op, "aplicada", { registro: novo }),
    auditoria: { acao: "excluir", antes: { excluido: false }, depois: { excluido: true } },
    conflitos: []
  };
}

// ../dominio/src/sync/recebimento.ts
function montarRecebimento(porColecao, ctx, desde, limite) {
  var _a, _b;
  const todos2 = [];
  for (const { colecao: colecao2, registros } of porColecao) {
    for (const reg of registros) if (((_a = reg.seq) != null ? _a : 0) > desde) todos2.push({ col: colecao2, reg });
  }
  todos2.sort((a, b2) => {
    var _a2, _b2;
    return ((_a2 = a.reg.seq) != null ? _a2 : 0) - ((_b2 = b2.reg.seq) != null ? _b2 : 0);
  });
  const lote = todos2.slice(0, limite);
  return {
    registros: lote.map(({ col, reg }) => ({
      colecao: col.nome,
      registro: podeLer(ctx, col, reg) ? reg : { id: reg.id, versao: reg.versao, seq: reg.seq, excluido: true }
    })),
    cursor: lote.length ? (_b = lote[lote.length - 1].reg.seq) != null ? _b : desde : desde,
    mais: todos2.length > limite
  };
}

// ../dominio/src/especies/importar.ts
var COLUNAS_ESPECIE = {
  nome_popular: { rotulo: "Nome popular", aceitos: ["nome popular", "nome polular", "nomes populares", "popular"], tipo: "texto" },
  familia: { rotulo: "Fam\xEDlia", aceitos: ["familia", "familia botanica"], tipo: "texto" },
  nome_cientifico: { rotulo: "Nome cient\xEDfico", aceitos: ["nome cientifico", "cientifico", "especie"], tipo: "texto" },
  autor: { rotulo: "Autor", aceitos: ["autor", "autoria"], tipo: "texto" },
  forma_vida: { rotulo: "Forma de vida", aceitos: ["forma de vida", "habito"], tipo: "texto" },
  folha: { rotulo: "Folha", aceitos: ["folha"], tipo: "texto" },
  disposicao: { rotulo: "Disposi\xE7\xE3o das folhas", aceitos: ["disposicao", "disposicao das folhas"], tipo: "texto" },
  latex: { rotulo: "L\xE1tex ou resina", aceitos: ["latex", "latex ou resina"], tipo: "texto" },
  espinhos: { rotulo: "Espinhos", aceitos: ["espinhos", "espinho"], tipo: "texto" },
  casca: { rotulo: "Casca", aceitos: ["casca"], tipo: "texto" },
  flor: { rotulo: "Flor", aceitos: ["flor", "flores"], tipo: "texto" },
  fruto: { rotulo: "Fruto", aceitos: ["fruto", "frutos"], tipo: "texto" },
  meses_flor: { rotulo: "Meses de flor", aceitos: ["meses de flor", "floracao", "meses flor"], tipo: "meses" },
  meses_fruto: { rotulo: "Meses de fruto", aceitos: ["meses de fruto", "frutificacao", "meses fruto"], tipo: "meses" },
  lorenzi_volume: { rotulo: "Lorenzi volume", aceitos: ["lorenzi volume", "lorenzi vol", "volume lorenzi"], tipo: "numero" },
  lorenzi_pagina: { rotulo: "Lorenzi p\xE1gina", aceitos: ["lorenzi pagina", "lorenzi pag", "pagina lorenzi"], tipo: "numero" },
  sementes_por_kg: { rotulo: "Sementes por kg", aceitos: ["sementes por kg", "sementes kg"], tipo: "numero" },
  dormencia: { rotulo: "Dorm\xEAncia", aceitos: ["dormencia"], tipo: "texto" },
  tratamento_pre_germinativo: { rotulo: "Tratamento pr\xE9-germinativo", aceitos: ["tratamento pre germinativo", "quebra de dormencia", "tratamento"], tipo: "texto" },
  dias_germinacao: { rotulo: "Dias para germinar", aceitos: ["dias para germinar", "dias germinacao", "tempo de germinacao"], tipo: "numero" },
  meses_ate_pronta: { rotulo: "Meses at\xE9 a muda ficar pronta", aceitos: ["meses ate a muda ficar pronta", "meses ate pronta", "tempo no viveiro"], tipo: "numero" },
  grupo_sucessional: { rotulo: "Grupo sucessional", aceitos: ["grupo sucessional", "grupo ecologico"], tipo: "texto" },
  origem: { rotulo: "Origem (nativa/ex\xF3tica)", aceitos: ["origem", "origem nativa exotica", "nativa ou exotica"], tipo: "texto" }
};
var CAMPOS_FICHA = Object.keys(COLUNAS_ESPECIE).filter((c) => !["nome_popular", "nome_cientifico", "familia"].includes(c));

// ../dominio/src/geo.ts
function coordenadaValida(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && lat > -35 && lat < 6 && lon > -75 && lon < -28;
}

// ../dominio/src/matrizes.ts
function parametro(parametros, chave, viveiroId) {
  var _a;
  const ativos5 = parametros.filter((p2) => p2.chave === chave && !p2.excluido);
  const doViveiro = viveiroId ? ativos5.find((p2) => p2.viveiro_id === viveiroId) : void 0;
  const geral = ativos5.find((p2) => !p2.viveiro_id);
  const p = doViveiro != null ? doViveiro : geral;
  return p && p.valor !== void 0 && p.valor !== null ? p.valor : (_a = PARAMETROS_PADRAO[chave]) == null ? void 0 : _a.valor;
}

// ../dominio/src/viveiro.ts
function saldoMudas(movs) {
  var _a;
  let s = 0;
  for (const m of movs) {
    if (m.excluido) continue;
    const q = Number((_a = m.quantidade) != null ? _a : 0);
    if (m.tipo === "entrada") s += Math.abs(q);
    else if (m.tipo === "ajuste_inventario") s += q;
    else s -= Math.abs(q);
  }
  return s;
}
function disponivel(saldo, reservasAtivas) {
  return Math.max(0, saldo - reservasAtivas.reduce((s, r2) => {
    var _a;
    return s + Number((_a = r2.quantidade) != null ? _a : 0);
  }, 0));
}

// ../dominio/src/doacao.ts
var ativos = (rs) => rs.filter((r2) => !r2.excluido);
var dia = (s) => String(s != null ? s : "").slice(0, 10);
var SITUACOES_EM_ANALISE = ["enviada", "em_analise"];
var SITUACOES_APROVADAS = ["aprovada", "aprovada_parcial"];
function reservaAtiva(r2, hoje) {
  return !r2.excluido && r2.situacao === "ativa" && (!r2.valida_ate || dia(r2.valida_ate) >= dia(hoje));
}
function planejarReservas(itens, lotes) {
  var _a, _b;
  const restante = new Map(lotes.map((l) => [l.id, l.disponivel]));
  const ordenados = [...lotes].sort((a, b2) => a.data_semeadura.localeCompare(b2.data_semeadura) || a.id.localeCompare(b2.id));
  const reservas = [];
  for (const item of itens) {
    let falta = item.quantidade;
    for (const l of ordenados) {
      if (falta <= 0) break;
      if (l.especie_id !== item.especie_id) continue;
      const q = Math.min(falta, (_a = restante.get(l.id)) != null ? _a : 0);
      if (q <= 0) continue;
      reservas.push({ doacao_item_id: item.doacao_item_id, lote_mudas_id: l.id, quantidade: q });
      restante.set(l.id, ((_b = restante.get(l.id)) != null ? _b : 0) - q);
      falta -= q;
    }
    if (falta > 0) return { erro: `Faltam ${falta} mudas prontas para atender o item ${item.doacao_item_id}.` };
  }
  return { reservas };
}
function situacaoAposAnalise(itens) {
  const aprovado = itens.reduce((s, i) => s + i.qtd_aprovada, 0);
  if (!aprovado) return "negada";
  return itens.every((i) => i.qtd_aprovada >= i.qtd_pedida) ? "aprovada" : "aprovada_parcial";
}
function prazoRetirada(aprovadoEm, dias) {
  const d2 = /* @__PURE__ */ new Date(`${dia(aprovadoEm)}T12:00:00Z`);
  d2.setUTCDate(d2.getUTCDate() + dias);
  return d2.toISOString().slice(0, 10);
}
function marcadaNoPrograma(historico, doacaoId, programaId) {
  const h = ativos(historico).filter((x) => x.doacao_id === doacaoId && x.programa_id === programaId).sort((a, b2) => {
    var _a, _b, _c, _d;
    return String((_b = (_a = a.criado_no_aparelho_em) != null ? _a : a.created) != null ? _b : "").localeCompare(String((_d = (_c = b2.criado_no_aparelho_em) != null ? _c : b2.created) != null ? _d : ""));
  });
  return h.length ? h[h.length - 1].acao === "marcou" : false;
}

// ../dominio/src/catalogo.ts
var ativos2 = (rs) => rs.filter((r2) => !r2.excluido);
function agrupar(rs, campo) {
  var _a;
  const m = /* @__PURE__ */ new Map();
  for (const r2 of rs) {
    const k = String(r2[campo]);
    ((_a = m.get(k)) != null ? _a : m.set(k, []).get(k)).push(r2);
  }
  return m;
}
function disponivelPorLote(d2, hoje = (/* @__PURE__ */ new Date()).toISOString()) {
  var _a, _b;
  const movs = agrupar(ativos2(d2.movimentos), "lote_mudas_id");
  const res = agrupar(
    d2.reservas.filter((r2) => reservaAtiva(r2, hoje)),
    "lote_mudas_id"
  );
  const m = /* @__PURE__ */ new Map();
  for (const l of ativos2(d2.lotesMudas)) {
    if (l.fase_atual !== "pronta" || l.situacao === "encerrado") continue;
    m.set(l.id, disponivel(saldoMudas((_a = movs.get(l.id)) != null ? _a : []), (_b = res.get(l.id)) != null ? _b : []));
  }
  return m;
}
function montarCatalogo(d2) {
  var _a, _b, _c, _d, _e, _f, _g;
  const disp = disponivelPorLote(d2);
  const especies = new Map(ativos2(d2.especies).map((e) => [e.id, e]));
  const viveiros = new Map(ativos2(d2.viveiros).map((v) => [v.id, v]));
  const populares = agrupar(ativos2(d2.nomesPopulares), "especie_id");
  const fotos = agrupar(
    ativos2(d2.fotos).filter((f) => f.arquivo),
    "especie_id"
  );
  const itens = /* @__PURE__ */ new Map();
  for (const l of ativos2(d2.lotesMudas)) {
    const q = (_a = disp.get(l.id)) != null ? _a : 0;
    if (q <= 0) continue;
    const e = especies.get(String(l.especie_id));
    if (!e || !e.publicada || e.ficticia) continue;
    let item = itens.get(e.id);
    if (!item) {
      const ordemFoto = ["muda", "arvore", "flor", "fruto", "folha"];
      const fs = [...(_b = fotos.get(e.id)) != null ? _b : []].sort((a, b2) => ordemFoto.indexOf(String(a.parte)) - ordemFoto.indexOf(String(b2.parte)));
      item = {
        especie_id: e.id,
        nome_cientifico: String(e.nome_cientifico),
        familia: String((_c = e.familia) != null ? _c : ""),
        nomes_populares: ((_d = populares.get(e.id)) != null ? _d : []).map((n2) => String(n2.nome)),
        por_viveiro: [],
        total: 0,
        foto: fs[0] ? { id: fs[0].id, arquivo: String(fs[0].arquivo), miniatura: String((_e = fs[0].miniatura) != null ? _e : ""), parte: String(fs[0].parte) } : void 0
      };
      itens.set(e.id, item);
    }
    const vid = String(l.viveiro_id);
    let pv = item.por_viveiro.find((p) => p.viveiro_id === vid);
    if (!pv) {
      pv = { viveiro_id: vid, viveiro: String((_g = (_f = viveiros.get(vid)) == null ? void 0 : _f.nome) != null ? _g : ""), disponivel: 0 };
      item.por_viveiro.push(pv);
    }
    pv.disponivel += q;
    item.total += q;
  }
  return [...itens.values()].sort((a, b2) => {
    var _a2, _b2;
    return ((_a2 = a.nomes_populares[0]) != null ? _a2 : a.nome_cientifico).localeCompare((_b2 = b2.nomes_populares[0]) != null ? _b2 : b2.nome_cientifico, "pt-BR");
  });
}
function montarRastreio(lote, d2) {
  var _a, _b, _c, _d, _e;
  const viveiro = d2.viveiros.find((v) => v.id === lote.viveiro_id);
  const r2 = {
    lote_mudas: __spreadValues({ codigo: String(lote.codigo), viveiro: String((_a = viveiro == null ? void 0 : viveiro.nome) != null ? _a : ""), data_semeadura: String((_b = lote.data_semeadura) != null ? _b : ""), fase: String((_c = lote.fase_atual) != null ? _c : "") }, lote.origem === "estoque_inicial" ? { estoque_inicial: true } : {})
  };
  const ls = d2.lotesSementes.find((l) => l.id === lote.lote_sementes_id && !l.excluido);
  if (!ls) return r2;
  const coletaIds = new Set(ativos2(d2.ligacoes).filter((l) => l.lote_sementes_id === ls.id).map((l) => String(l.coleta_id)));
  const matrizIds = new Set(ativos2(d2.coletas).filter((c) => coletaIds.has(c.id)).map((c) => String(c.matriz_id)));
  const nomesMun = new Map(d2.municipios.map((m) => [m.id, String(m.nome)]));
  const municipios = /* @__PURE__ */ new Set();
  for (const m of d2.matrizes) if (matrizIds.has(m.id) && m.municipio_id) municipios.add((_d = nomesMun.get(String(m.municipio_id))) != null ? _d : "");
  municipios.delete("");
  r2.lote_sementes = { codigo: String(ls.codigo), data_formacao: String((_e = ls.data_formacao) != null ? _e : ""), matrizes: matrizIds.size, municipios: [...municipios].sort() };
  return r2;
}
var CAMPOS_FICHA_PUBLICA = [
  "nome_cientifico",
  "autor",
  "familia",
  "origem",
  "forma_vida",
  "folha",
  "disposicao",
  "latex",
  "espinhos",
  "casca",
  "flor",
  "fruto",
  "meses_flor",
  "meses_fruto",
  "grupo_sucessional",
  "lorenzi_volume",
  "lorenzi_pagina"
];
function fichaPublica(e) {
  const f = { id: e.id };
  for (const c of CAMPOS_FICHA_PUBLICA) if (e[c] !== void 0 && e[c] !== null && e[c] !== "" && e[c] !== 0) f[c] = e[c];
  return f;
}

// ../dominio/src/posplantio.ts
var ativos3 = (rs) => rs.filter((r2) => !r2.excluido);
function taxaSobrevivencia(plantadas, vivas) {
  if (!plantadas) return null;
  return Math.round(vivas / plantadas * 1e3) / 10;
}
function sobrevivenciaDoPlantio(plantioItens, monitoramentos, monitoramentoItens) {
  var _a, _b, _c;
  const plantadasPor = /* @__PURE__ */ new Map();
  for (const i of ativos3(plantioItens)) plantadasPor.set(String(i.especie_id), ((_a = plantadasPor.get(String(i.especie_id))) != null ? _a : 0) + Number((_b = i.quantidade) != null ? _b : 0));
  const plantadas = [...plantadasPor.values()].reduce((s, q) => s + q, 0);
  const ultimo = ativos3(monitoramentos).sort((a, b2) => String(b2.data).localeCompare(String(a.data)) || Number(b2.tipo === "vistoria") - Number(a.tipo === "vistoria"))[0];
  if (!ultimo) {
    return { monitoramento_id: null, data: null, tipo: null, plantadas, vivas: plantadas, taxa: null, por_especie: [...plantadasPor].map(([especie_id, p]) => ({ especie_id, plantadas: p, vivas: p, taxa: null })) };
  }
  const vivasPor = /* @__PURE__ */ new Map();
  for (const i of ativos3(monitoramentoItens).filter((i2) => i2.monitoramento_id === ultimo.id)) vivasPor.set(String(i.especie_id), Number((_c = i.vivas) != null ? _c : 0));
  const por_especie = [...plantadasPor].map(([especie_id, p]) => {
    var _a2;
    const v = (_a2 = vivasPor.get(especie_id)) != null ? _a2 : 0;
    return { especie_id, plantadas: p, vivas: v, taxa: taxaSobrevivencia(p, v) };
  });
  const vivas = por_especie.reduce((s, e) => s + e.vivas, 0);
  return { monitoramento_id: ultimo.id, data: String(ultimo.data), tipo: String(ultimo.tipo), plantadas, vivas, taxa: taxaSobrevivencia(plantadas, vivas), por_especie };
}
function pontoDoPlantio(geometria) {
  const g = geometria;
  if (!g || g.type !== "Point" || !Array.isArray(g.coordinates)) return null;
  const [lon, lat] = g.coordinates;
  return coordenadaValida(lat, lon) ? { lat, lon } : null;
}

// ../dominio/src/relatorios.ts
var ativos4 = (rs) => rs.filter((r2) => !r2.excluido);
var dia2 = (v) => String(v != null ? v : "").slice(0, 10);
function doacoesDoPrograma(historico, programaId) {
  const ids = new Set(ativos4(historico).filter((h) => h.programa_id === programaId).map((h) => String(h.doacao_id)));
  return new Set([...ids].filter((d2) => marcadaNoPrograma(historico, d2, programaId)));
}
var generalizar = (v) => Math.round(v * 100) / 100;
function montarTransparencia(d2, programaId = "plantandoagua01") {
  var _a, _b, _c;
  const retiradas = ativos4(d2.doacoes).filter((x) => x.situacao === "retirada");
  const ids = new Set(retiradas.map((x) => x.id));
  const itens = ativos4(d2.doacaoItens).filter((i) => ids.has(String(i.doacao_id)));
  const ficticias = new Set(ativos4(d2.especies).filter((e) => e.ficticia).map((e) => e.id));
  const nomes = new Map(ativos4(d2.especies).map((e) => [e.id, String(e.nome_cientifico)]));
  const vistos = /* @__PURE__ */ new Set();
  for (const n2 of ativos4(d2.nomesPopulares)) if (!vistos.has(String(n2.especie_id))) {
    vistos.add(String(n2.especie_id));
    nomes.set(String(n2.especie_id), String(n2.nome));
  }
  const porEspecie = /* @__PURE__ */ new Map();
  for (const i of itens) if (!ficticias.has(String(i.especie_id))) porEspecie.set(String(i.especie_id), ((_a = porEspecie.get(String(i.especie_id))) != null ? _a : 0) + Number((_b = i.qtd_entregue) != null ? _b : 0));
  const programa = doacoesDoPrograma(d2.historicoProgramas, programaId);
  const ano = (r2) => {
    var _a2, _b2;
    return dia2((_b2 = (_a2 = r2.data) != null ? _a2 : r2.criado_no_aparelho_em) != null ? _b2 : r2.created).slice(0, 4) || "sem data";
  };
  const porAno = /* @__PURE__ */ new Map();
  for (const x of retiradas) {
    const q = itens.filter((i) => i.doacao_id === x.id).reduce((s, i) => {
      var _a2;
      return s + Number((_a2 = i.qtd_entregue) != null ? _a2 : 0);
    }, 0);
    porAno.set(ano(x), ((_c = porAno.get(ano(x))) != null ? _c : 0) + q);
  }
  let plantadasComAcomp = 0;
  let vivas = 0;
  const pontos = [];
  for (const p of ativos4(d2.plantios)) {
    const s = sobrevivenciaDoPlantio(
      d2.plantioItens.filter((i) => i.plantio_id === p.id),
      d2.monitoramentos.filter((m) => m.plantio_id === p.id),
      d2.monitoramentoItens
    );
    if (s.taxa !== null) {
      plantadasComAcomp += s.plantadas;
      vivas += s.vivas;
    }
    const pt = pontoDoPlantio(p.geometria);
    if (pt) pontos.push({ lat: generalizar(pt.lat), lon: generalizar(pt.lon), mudas: s.plantadas, ano: ano(p) });
  }
  const mudasDoadas = itens.reduce((s, i) => {
    var _a2;
    return s + Number((_a2 = i.qtd_entregue) != null ? _a2 : 0);
  }, 0);
  return {
    mudas_doadas: mudasDoadas,
    mudas_plantadas: ativos4(d2.plantioItens).reduce((s, i) => {
      var _a2;
      return s + Number((_a2 = i.quantidade) != null ? _a2 : 0);
    }, 0),
    sobrevivencia: taxaSobrevivencia(plantadasComAcomp, vivas),
    doacoes: retiradas.length,
    plantando_agua: {
      doacoes: retiradas.filter((x) => programa.has(x.id)).length,
      mudas_doadas: itens.filter((i) => programa.has(String(i.doacao_id))).reduce((s, i) => {
        var _a2;
        return s + Number((_a2 = i.qtd_entregue) != null ? _a2 : 0);
      }, 0)
    },
    especies_mais_distribuidas: [...porEspecie].sort((a, b2) => b2[1] - a[1]).slice(0, 10).map(([e, mudas]) => {
      var _a2;
      return { especie: (_a2 = nomes.get(e)) != null ? _a2 : "", mudas };
    }),
    plantios: pontos,
    por_ano: [...porAno].sort((a, b2) => a[0].localeCompare(b2[0])).map(([a, m]) => ({ ano: a, mudas_doadas: m }))
  };
}

// ../dominio/src/municipios.ts
var UF_CODIGO = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53"
};
var UF_POR_CODIGO = Object.fromEntries(Object.entries(UF_CODIGO).map(([uf, c]) => [c, uf]));

// src/crads.ts
var ALFABETO_ID = "abcdefghijklmnopqrstuvwxyz0123456789";
var CONTROLE = ["versao", "seq", "excluido", "criado_por", "atualizado_por", "dispositivo_id", "criado_no_aparelho_em"];
var ID_CONTADOR = "contadorglobal1";
var LIMITE_RECEBIMENTO = 500;
var novoId = () => $security.randomStringWithAlphabet(15, ALFABETO_ID);
function buscar(app, col, id) {
  try {
    return app.findRecordById(col, id);
  } catch (e) {
    return null;
  }
}
function paraObjeto(col, rec) {
  var _a;
  const bruto = JSON.parse(JSON.stringify(rec));
  const o2 = { id: bruto.id, versao: (_a = bruto.versao) != null ? _a : 0 };
  for (const k of [...nomesCampos(col), ...CONTROLE, "created", "updated"]) if (k in bruto) o2[k] = bruto[k];
  return o2;
}
function proximoSeq(app) {
  let rec = buscar(app, "sync_contador", ID_CONTADOR);
  if (!rec) {
    rec = new Record(app.findCollectionByNameOrId("sync_contador"));
    rec.set("id", ID_CONTADOR);
    rec.set("valor", 0);
  }
  const valor = rec.getInt("valor") + 1;
  rec.set("valor", valor);
  app.save(rec);
  return valor;
}
function gravar(app, col, reg) {
  let rec = buscar(app, col.nome, reg.id);
  if (!rec) {
    rec = new Record(app.findCollectionByNameOrId(col.nome));
    rec.set("id", reg.id);
  }
  const arquivos = new Set(col.campos.filter((c) => c.tipo === "arquivo").map((c) => c.nome));
  for (const k of [...nomesCampos(col), ...CONTROLE]) {
    if (k === "seq" || arquivos.has(k) || !(k in reg)) continue;
    const v = reg[k];
    rec.set(k, v === void 0 ? null : v);
  }
  rec.set("seq", proximoSeq(app));
  app.save(rec);
  return rec;
}
function auditar(app, dados) {
  const rec = new Record(app.findCollectionByNameOrId("auditoria"));
  rec.set("id", novoId());
  for (const [k, v] of Object.entries(dados)) rec.set(k, v != null ? v : null);
  app.save(rec);
}
function contextoDe(app, auth) {
  var _a;
  const perfisPorViveiro = {};
  const vinculos = app.findRecordsByFilter("usuario_viveiro", "usuario_id = {:u} && excluido = false", "", 0, 0, { u: auth.id });
  for (const v of vinculos) {
    const viv = v.getString("viveiro_id");
    ((_a = perfisPorViveiro[viv]) != null ? _a : perfisPorViveiro[viv] = []).push(v.getString("perfil"));
  }
  return {
    id: auth.id,
    gestorGeral: !!auth.getBool("gestor_geral"),
    solicitante: !!auth.getBool("solicitante"),
    perfisPorViveiro,
    permissoes: matrizDe(todos(app, "parametro"))
  };
}
function reservarNumeros(app, tipo, ano, quantidade) {
  let seq;
  try {
    seq = app.findFirstRecordByFilter("sequencia_codigo", "tipo = {:t} && ano = {:a}", { t: tipo, a: ano });
  } catch (e) {
    seq = new Record(app.findCollectionByNameOrId("sequencia_codigo"));
    seq.set("id", novoId());
    seq.set("tipo", tipo);
    seq.set("ano", ano);
    seq.set("proximo", 1);
  }
  const inicio = seq.getInt("proximo");
  seq.set("proximo", inicio + quantidade);
  app.save(seq);
  return { inicio, fim: inicio + quantidade - 1 };
}
function anoDe(reg) {
  var _a;
  const s = String((_a = reg.criado_no_aparelho_em) != null ? _a : "");
  const ano = Number(s.slice(0, 4));
  return ano > 2e3 ? ano : (/* @__PURE__ */ new Date()).getFullYear();
}
function porta(app, dispositivoId) {
  return {
    codigoEmUso(col, codigo, excetoId) {
      try {
        app.findFirstRecordByFilter(col, "codigo = {:c} && id != {:i}", { c: codigo, i: excetoId });
        return true;
      } catch (e) {
        return false;
      }
    },
    novoCodigo(col, reg) {
      if (col.prefixoCodigo === "LM" && reg.origem === "estoque_inicial") {
        const ano2 = anoDe(reg);
        const existentes = app.findRecordsByFilter("lote_mudas", "codigo ~ {:p}", "", 0, 0, { p: `LM-${ano2}-I-` });
        return proximoCodigoEstoqueInicial(ano2, existentes.map((r2) => r2.getString("codigo")));
      }
      if (col.prefixoCodigo === "LM") {
        const ls = buscar(app, "lote_sementes", String(reg.lote_sementes_id));
        if (!ls) throw new Error("lote de sementes do lote de mudas n\xE3o encontrado");
        const codLS = ls.getString("codigo");
        const irmaos = app.findRecordsByFilter("lote_mudas", "codigo ~ {:p}", "", 0, 0, { p: codLS.replace("LS-", "LM-") + "-" });
        return proximoCodigoLoteMudas(codLS, irmaos.map((r2) => r2.getString("codigo")));
      }
      const tipo = col.prefixoCodigo;
      const ano = TIPOS_COM_ANO.has(tipo) ? anoDe(reg) : 0;
      return formatarCodigo(tipo, ano, reservarNumeros(app, tipo, ano, 1).inicio);
    },
    faixasDoDispositivo(id) {
      return app.findRecordsByFilter("faixa_codigo", "dispositivo_id = {:d}", "", 0, 0, { d: id || dispositivoId }).map((r2) => ({
        tipo: r2.getString("tipo"),
        ano: r2.getInt("ano"),
        inicio: r2.getInt("inicio"),
        fim: r2.getInt("fim"),
        ultimo: r2.getInt("inicio") - 1
      }));
    }
  };
}
function enviar(app, auth, corpo) {
  var _a, _b;
  const ctx = contextoDe(app, auth);
  const dispositivo = String((_a = corpo.dispositivo_id) != null ? _a : "");
  const resultados = [];
  for (const op of (_b = corpo.operacoes) != null ? _b : []) {
    let res = null;
    try {
      app.runInTransaction((tx) => {
        try {
          const feita = tx.findFirstRecordByFilter("sync_op", "op_id = {:o}", { o: op.op_id });
          const anterior = JSON.parse(JSON.stringify(feita)).resultado;
          const atual2 = existeColecao(op.colecao) ? buscar(tx, op.colecao, op.registro_id) : null;
          res = __spreadProps(__spreadValues({}, anterior), { registro: atual2 ? paraObjeto(colecao(op.colecao), atual2) : anterior.registro });
          return;
        } catch (e) {
        }
        const col = existeColecao(op.colecao) ? colecao(op.colecao) : null;
        const atualRec = col ? buscar(tx, col.nome, op.registro_id) : null;
        const atual = col && atualRec ? paraObjeto(col, atualRec) : null;
        const opSegura = __spreadProps(__spreadValues({}, op), { dispositivo_id: dispositivo || op.dispositivo_id });
        const d2 = resolverOperacao(opSegura, atual, ctx, porta(tx, dispositivo));
        if (col && d2.gravar) {
          const salvo = gravar(tx, col, d2.gravar);
          d2.resultado.registro = paraObjeto(col, salvo);
        }
        if (d2.auditoria) {
          auditar(tx, {
            colecao: op.colecao,
            registro_id: op.registro_id,
            acao: d2.auditoria.acao,
            antes: d2.auditoria.antes,
            depois: d2.auditoria.depois,
            usuario_id: ctx.id,
            dispositivo_id: opSegura.dispositivo_id,
            data_aparelho: op.criado_no_aparelho_em
          });
        }
        if (d2.conflitos.length) {
          gravar(tx, colecao("conflito"), {
            id: novoId(),
            versao: 1,
            excluido: false,
            colecao: op.colecao,
            registro_id: op.registro_id,
            campos: d2.conflitos,
            usuario_id: ctx.id,
            situacao: "aberto",
            criado_por: ctx.id,
            atualizado_por: ctx.id,
            dispositivo_id: opSegura.dispositivo_id,
            criado_no_aparelho_em: op.criado_no_aparelho_em
          });
        }
        if (d2.resultado.status !== "rejeitada") {
          const s = new Record(tx.findCollectionByNameOrId("sync_op"));
          s.set("id", novoId());
          s.set("op_id", op.op_id);
          s.set("usuario_id", ctx.id);
          s.set("resultado", __spreadProps(__spreadValues({}, d2.resultado), { registro: void 0 }));
          tx.save(s);
        }
        res = d2.resultado;
      });
    } catch (err) {
      res = { op_id: op.op_id, colecao: op.colecao, registro_id: op.registro_id, status: "rejeitada", motivo: `erro no servidor: ${String(err)}` };
    }
    resultados.push(res);
  }
  registrarDispositivo(app, dispositivo, ctx.id, "ultimo_envio");
  return { resultados };
}
function receber(app, auth, desde, limite = LIMITE_RECEBIMENTO, dispositivo = "") {
  const ctx = contextoDe(app, auth);
  const lim = Math.max(1, Math.min(limite, 2e3));
  const viveiros = viveirosVisiveis(ctx);
  const filtroViveiro = viveiros === null ? "" : viveiros.length ? "(" + viveiros.map((_, i) => `viveiro_id = {:v${i}}`).join(" || ") + ")" : "";
  const params = { desde, eu: ctx.id };
  (viveiros != null ? viveiros : []).forEach((v, i) => params[`v${i}`] = v);
  const porColecao = [];
  for (const col of COLECOES) {
    let filtro = "seq > {:desde}";
    if (col.porViveiro && viveiros !== null) {
      const partes = [];
      if (filtroViveiro) partes.push(filtroViveiro);
      if (ctx.solicitante && col.campoDono) partes.push(`${col.campoDono} = {:eu}`);
      if (!partes.length) continue;
      filtro += ` && (${partes.join(" || ")})`;
    }
    const recs = app.findRecordsByFilter(col.nome, filtro, "seq", lim + 1, 0, params);
    porColecao.push({ colecao: col, registros: recs.map((r2) => paraObjeto(col, r2)) });
  }
  if (dispositivo) registrarDispositivo(app, dispositivo, ctx.id, "ultimo_recebimento");
  return montarRecebimento(porColecao, ctx, desde, lim);
}
function reservarFaixas(app, auth, corpo) {
  var _a;
  const ctx = contextoDe(app, auth);
  const dispositivo = String((_a = corpo.dispositivo_id) != null ? _a : "");
  if (!/^[a-z0-9]{15}$/.test(dispositivo)) throw new Error("dispositivo_id inv\xE1lido");
  const faixas = [];
  app.runInTransaction((tx) => {
    var _a2;
    for (const p of (_a2 = corpo.pedidos) != null ? _a2 : []) {
      if (!["MT", "LS", "DO"].includes(p.tipo)) throw new Error(`tipo de c\xF3digo inv\xE1lido: ${p.tipo}`);
      const tipo = p.tipo;
      const ano = TIPOS_COM_ANO.has(tipo) ? Number(p.ano) || (/* @__PURE__ */ new Date()).getFullYear() : 0;
      const qtd = Math.max(1, Math.min(Number(p.quantidade) || 20, 200));
      const { inicio, fim } = reservarNumeros(tx, tipo, ano, qtd);
      const rec = new Record(tx.findCollectionByNameOrId("faixa_codigo"));
      rec.set("id", novoId());
      for (const [k, v] of Object.entries({ dispositivo_id: dispositivo, usuario_id: ctx.id, tipo, ano, inicio, fim })) rec.set(k, v);
      tx.save(rec);
      faixas.push({ tipo, ano, inicio, fim, ultimo: inicio - 1 });
    }
  });
  registrarDispositivo(app, dispositivo, ctx.id, "");
  return { faixas };
}
function eu(app, auth) {
  const ctx = contextoDe(app, auth);
  const viveiros = new Map(todos(app, "viveiro").map((v) => [v.id, String(v.nome)]));
  const pedidos = app.findRecordsByFilter("pedido_acesso", "usuario_id = {:u} && excluido = false", "-created", 5, 0, { u: auth.id }).map((r2) => {
    var _a;
    return { perfil: r2.getString("perfil"), viveiro: (_a = viveiros.get(r2.getString("viveiro_id"))) != null ? _a : "", situacao: r2.getString("situacao"), motivo: r2.getString("motivo") };
  });
  return __spreadProps(__spreadValues({}, ctx), { nome: auth.getString("name"), email: auth.getString("email"), pedidos_acesso: pedidos });
}
function receberArquivo(app, auth, nomeCol, id, campo, arquivos, dispositivo = "") {
  if (!existeColecao(nomeCol)) throw new Error("cole\xE7\xE3o desconhecida");
  const col = colecao(nomeCol);
  if (!col.campos.some((c) => c.nome === campo && c.tipo === "arquivo")) throw new Error("campo de arquivo desconhecido");
  if (!arquivos.length) throw new Error("nenhum arquivo enviado");
  const ctx = contextoDe(app, auth);
  let registro = null;
  app.runInTransaction((tx) => {
    const rec = buscar(tx, nomeCol, id);
    if (!rec) throw new Error("registro ainda n\xE3o sincronizado");
    if (!podeEscrever(ctx, col, paraObjeto(col, rec))) throw new Error("sem permiss\xE3o");
    rec.set(campo, arquivos[0]);
    rec.set("seq", proximoSeq(tx));
    tx.save(rec);
    auditar(tx, { colecao: nomeCol, registro_id: id, acao: "arquivo", antes: null, depois: { campo, arquivo: rec.getString(campo) }, usuario_id: ctx.id, dispositivo_id: dispositivo });
    registro = paraObjeto(col, rec);
  });
  return { registro };
}
function registrarDispositivo(app, id, usuarioId, campo) {
  if (!/^[a-z0-9]{15}$/.test(id)) return;
  try {
    let rec = buscar(app, "dispositivo", id);
    if (!rec) {
      rec = new Record(app.findCollectionByNameOrId("dispositivo"));
      rec.set("id", id);
    }
    rec.set("usuario_id", usuarioId);
    if (campo) rec.set(campo, (/* @__PURE__ */ new Date()).toISOString());
    app.save(rec);
  } catch (e) {
  }
}
var EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PERFIS_EQUIPE = ["coletor", "viveirista", "gestor"];
function controle(usuarioId, viveiroId) {
  return { versao: 1, excluido: false, criado_por: usuarioId, atualizado_por: usuarioId, criado_no_aparelho_em: hojeISO(), viveiro_id: viveiroId };
}
function usuarioPorEmail(app, email) {
  try {
    return app.findAuthRecordByEmail("users", email);
  } catch (e) {
    return null;
  }
}
function novoUsuario(app, d2) {
  const u = new Record(app.findCollectionByNameOrId("users"));
  u.setEmail(d2.email);
  u.setPassword(d2.senha);
  u.set("name", d2.nome);
  u.set("solicitante", d2.solicitante);
  app.save(u);
  return u;
}
function validarConta(d2) {
  var _a, _b, _c;
  const nome = String((_a = d2.nome) != null ? _a : "").trim();
  const email = String((_b = d2.email) != null ? _b : "").trim().toLowerCase();
  const senha = String((_c = d2.senha) != null ? _c : "");
  if (nome.length < 3) throw new Error("Escreva o nome completo.");
  if (!EMAIL_OK.test(email)) throw new Error("E-mail inv\xE1lido.");
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 letras ou n\xFAmeros.");
  return { nome, email, senha };
}
function viveiroAtivo(app, id) {
  const v = buscar(app, "viveiro", id);
  if (!v || v.getBool("excluido") || v.getBool("ativo") === false) throw new Error("Escolha um viveiro.");
  return v;
}
function viveirosPublicos(app) {
  return todos(app, "viveiro").filter((v) => v.ativo !== false).map((v) => {
    var _a;
    return { id: v.id, nome: String(v.nome), sigla: String((_a = v.sigla) != null ? _a : "") };
  }).sort((a, b2) => a.nome.localeCompare(b2.nome, "pt-BR"));
}
function criarConta(app, corpo) {
  var _a;
  const d2 = validarConta(corpo);
  const perfil = String((_a = corpo.perfil) != null ? _a : "solicitante");
  if (!["solicitante", "coletor", "viveirista"].includes(perfil)) throw new Error("Perfil inv\xE1lido.");
  const umaHora = new Date(Date.now() - 36e5).toISOString().replace("T", " ");
  if (app.findRecordsByFilter("users", "created >= {:t}", "", 31, 0, { t: umaHora }).length > 30) throw new Error("Muitos cadastros agora. Tente de novo mais tarde.");
  let pendente = false;
  app.runInTransaction((tx) => {
    var _a2;
    if (usuarioPorEmail(tx, d2.email)) throw new Error("Este e-mail j\xE1 tem conta. Toque em Entrar.");
    const u = novoUsuario(tx, __spreadProps(__spreadValues({}, d2), { solicitante: perfil === "solicitante" }));
    if (perfil !== "solicitante") {
      const viveiroId = String((_a2 = corpo.viveiro_id) != null ? _a2 : "");
      viveiroAtivo(tx, viveiroId);
      const pedido = __spreadProps(__spreadValues({ id: novoId() }, controle(u.id, viveiroId)), { usuario_id: u.id, nome: d2.nome, email: d2.email, perfil, situacao: "pendente" });
      gravar(tx, colecao("pedido_acesso"), pedido);
      auditar(tx, { colecao: "pedido_acesso", registro_id: pedido.id, acao: "criar", antes: null, depois: pedido, usuario_id: u.id });
      pendente = true;
    }
  });
  return { ok: true, pendente };
}
function viveirosDaEquipe(ctx) {
  if (ctx.gestorGeral) return null;
  return Object.keys(ctx.perfisPorViveiro).filter((v) => temPermissao(ctx, "equipe", v));
}
function exigirEquipe(ctx, viveiroId) {
  if (!temPermissao(ctx, "equipe", viveiroId)) throw new Error("Voc\xEA n\xE3o tem permiss\xE3o para cuidar da equipe deste viveiro.");
}
function exigirPodeDarPerfil(ctx, viveiroId, perfil) {
  var _a;
  if (!PERFIS_EQUIPE.includes(perfil)) throw new Error("Perfil inv\xE1lido.");
  if (perfil === "gestor" && !ctx.gestorGeral && !((_a = ctx.perfisPorViveiro[viveiroId]) != null ? _a : []).includes("gestor")) throw new Error("S\xF3 um gestor pode cadastrar outro gestor.");
}
function equipe(app, auth) {
  const ctx = contextoDe(app, auth);
  const meus = viveirosDaEquipe(ctx);
  if (meus && !meus.length) throw new Error("Voc\xEA n\xE3o tem permiss\xE3o para cuidar da equipe.");
  const dentro = (v) => !meus || meus.includes(String(v));
  const viveiros = todos(app, "viveiro").filter((v) => dentro(v.id)).map((v) => ({ id: v.id, nome: String(v.nome) }));
  const vinculos = todos(app, "usuario_viveiro").filter((v) => dentro(v.viveiro_id));
  const pedidos = todos(app, "pedido_acesso").filter((p) => dentro(p.viveiro_id) && p.situacao === "pendente");
  const pessoas = /* @__PURE__ */ new Map();
  for (const v of vinculos) {
    const id = String(v.usuario_id);
    let p = pessoas.get(id);
    if (!p) {
      const u = buscar(app, "users", id);
      p = { usuario_id: id, nome: u ? u.getString("name") : "", email: u ? u.getString("email") : "", vinculos: [] };
      pessoas.set(id, p);
    }
    p.vinculos.push({ id: v.id, viveiro_id: String(v.viveiro_id), perfil: String(v.perfil) });
  }
  return {
    viveiros,
    pedidos: pedidos.map((p) => ({ id: p.id, nome: p.nome, email: p.email, perfil: p.perfil, viveiro_id: p.viveiro_id, criado: p.created })),
    pessoas: [...pessoas.values()].sort((a, b2) => a.nome.localeCompare(b2.nome, "pt-BR"))
  };
}
function vincular(tx, ctx, usuarioId, viveiroId, perfil) {
  const ja = todos(tx, "usuario_viveiro").some((v) => v.usuario_id === usuarioId && v.viveiro_id === viveiroId && v.perfil === perfil);
  if (ja) return;
  const reg = __spreadProps(__spreadValues({ id: novoId() }, controle(ctx.id, viveiroId)), { usuario_id: usuarioId, perfil });
  gravar(tx, colecao("usuario_viveiro"), reg);
  auditar(tx, { colecao: "usuario_viveiro", registro_id: reg.id, acao: "criar", antes: null, depois: reg, usuario_id: ctx.id });
}
function equipeCadastrar(app, auth, corpo) {
  var _a, _b;
  const ctx = contextoDe(app, auth);
  const viveiroId = String((_a = corpo.viveiro_id) != null ? _a : "");
  const perfil = String((_b = corpo.perfil) != null ? _b : "");
  exigirEquipe(ctx, viveiroId);
  exigirPodeDarPerfil(ctx, viveiroId, perfil);
  let criada = false;
  app.runInTransaction((tx) => {
    var _a2;
    viveiroAtivo(tx, viveiroId);
    const email = String((_a2 = corpo.email) != null ? _a2 : "").trim().toLowerCase();
    let u = EMAIL_OK.test(email) ? usuarioPorEmail(tx, email) : null;
    if (!u) {
      u = novoUsuario(tx, __spreadProps(__spreadValues({}, validarConta(corpo)), { solicitante: false }));
      criada = true;
    }
    vincular(tx, ctx, u.id, viveiroId, perfil);
  });
  return { ok: true, conta_nova: criada };
}
function equipeResponder(app, auth, id, corpo) {
  const ctx = contextoDe(app, auth);
  app.runInTransaction((tx) => {
    var _a;
    const rec = buscar(tx, "pedido_acesso", id);
    if (!rec || rec.getBool("excluido")) throw new Error("Pedido n\xE3o encontrado.");
    const pedido = paraObjeto(colecao("pedido_acesso"), rec);
    const viveiroId = String(pedido.viveiro_id);
    exigirEquipe(ctx, viveiroId);
    if (pedido.situacao !== "pendente") throw new Error("Este pedido j\xE1 foi respondido.");
    const perfil = String(corpo.perfil || pedido.perfil);
    if (corpo.aprovar) {
      exigirPodeDarPerfil(ctx, viveiroId, perfil);
      vincular(tx, ctx, String(pedido.usuario_id), viveiroId, perfil);
    }
    const novo = __spreadProps(__spreadValues({}, pedido), { situacao: corpo.aprovar ? "aprovado" : "recusado", analisado_por: ctx.id, motivo: String((_a = corpo.motivo) != null ? _a : ""), versao: Number(pedido.versao) + 1, atualizado_por: ctx.id });
    gravar(tx, colecao("pedido_acesso"), novo);
    auditar(tx, { colecao: "pedido_acesso", registro_id: id, acao: corpo.aprovar ? "aprovar" : "recusar", antes: { situacao: "pendente" }, depois: { situacao: novo.situacao, perfil }, usuario_id: ctx.id });
  });
  return { ok: true };
}
function equipeRemover(app, auth, id) {
  const ctx = contextoDe(app, auth);
  app.runInTransaction((tx) => {
    const rec = buscar(tx, "usuario_viveiro", id);
    if (!rec || rec.getBool("excluido")) throw new Error("Acesso n\xE3o encontrado.");
    const v = paraObjeto(colecao("usuario_viveiro"), rec);
    exigirEquipe(ctx, String(v.viveiro_id));
    if (v.usuario_id === ctx.id) throw new Error("Voc\xEA n\xE3o pode tirar o pr\xF3prio acesso.");
    if (v.perfil === "gestor") exigirPodeDarPerfil(ctx, String(v.viveiro_id), "gestor");
    gravar(tx, colecao("usuario_viveiro"), __spreadProps(__spreadValues({}, v), { excluido: true, versao: Number(v.versao) + 1, atualizado_por: ctx.id }));
    auditar(tx, { colecao: "usuario_viveiro", registro_id: id, acao: "excluir", antes: v, depois: { excluido: true }, usuario_id: ctx.id });
  });
  return { ok: true };
}
var hojeISO = () => (/* @__PURE__ */ new Date()).toISOString();
function lerParametro(app, chave, viveiroId) {
  return parametro(todos(app, "parametro"), chave, viveiroId);
}
function analisarDoacao(app, auth, id, corpo) {
  const ctx = contextoDe(app, auth);
  let resultado2 = null;
  app.runInTransaction((tx) => {
    var _a, _b, _c;
    const docRec = buscar(tx, "doacao", id);
    if (!docRec) throw new Error("Pedido n\xE3o encontrado.");
    const doacao = paraObjeto(colecao("doacao"), docRec);
    if (!SITUACOES_EM_ANALISE.includes(String(doacao.situacao))) throw new Error("Este pedido n\xE3o est\xE1 aguardando an\xE1lise.");
    const viveiroId = String(doacao.viveiro_id);
    if (!temPermissao(ctx, "aprovar_doacao", viveiroId)) throw new Error("Voc\xEA n\xE3o tem permiss\xE3o para aprovar pedidos de mudas.");
    const itens = tx.findRecordsByFilter("doacao_item", "doacao_id = {:d} && excluido = false", "", 0, 0, { d: id }).map((r2) => paraObjeto(colecao("doacao_item"), r2));
    const pedidoAprovado = new Map(((_a = corpo.itens) != null ? _a : []).map((i) => [i.item_id, Number(i.qtd_aprovada)]));
    for (const [itemId, q] of pedidoAprovado) {
      const item = itens.find((i) => i.id === itemId);
      if (!item) throw new Error("Item do pedido n\xE3o encontrado.");
      if (!Number.isInteger(q) || q < 0 || q > Number(item.qtd_pedida)) throw new Error("Quantidade aprovada inv\xE1lida.");
    }
    const aprovados = itens.map((i) => {
      var _a2;
      return { item: i, qtd: (_a2 = pedidoAprovado.get(i.id)) != null ? _a2 : 0 };
    });
    const situacao = situacaoAposAnalise(aprovados.map((a) => ({ qtd_pedida: Number(a.item.qtd_pedida), qtd_aprovada: a.qtd })));
    if (situacao === "negada" && !String((_b = corpo.justificativa) != null ? _b : "").trim()) throw new Error("Diga o motivo da recusa.");
    const doViveiro = (n2) => todos(tx, n2).filter((r2) => r2.viveiro_id === viveiroId);
    const lotes = doViveiro("lote_mudas");
    const disp = disponivelPorLote({ lotesMudas: lotes, movimentos: doViveiro("movimento_estoque_mudas"), reservas: doViveiro("reserva") });
    const plano = planejarReservas(
      aprovados.filter((a) => a.qtd > 0).map((a) => ({ doacao_item_id: a.item.id, especie_id: String(a.item.especie_id), quantidade: a.qtd })),
      lotes.filter((l) => disp.has(l.id)).map((l) => {
        var _a2, _b2;
        return { id: l.id, especie_id: String(l.especie_id), data_semeadura: String((_a2 = l.data_semeadura) != null ? _a2 : ""), disponivel: (_b2 = disp.get(l.id)) != null ? _b2 : 0 };
      })
    );
    if ("erro" in plano) throw new Error(plano.erro);
    const agora = hojeISO();
    const retirarAte = situacao === "negada" ? null : prazoRetirada(agora, lerParametro(tx, "prazo_retirada_dias", viveiroId));
    const controle2 = { versao: 1, excluido: false, criado_por: ctx.id, atualizado_por: ctx.id, criado_no_aparelho_em: agora, viveiro_id: viveiroId };
    for (const r2 of plano.reservas) gravar(tx, colecao("reserva"), __spreadProps(__spreadValues(__spreadValues({ id: novoId() }, controle2), r2), { valida_ate: retirarAte, situacao: "ativa" }));
    for (const a of aprovados) gravar(tx, colecao("doacao_item"), __spreadProps(__spreadValues({}, a.item), { qtd_aprovada: a.qtd, versao: Number(a.item.versao) + 1, atualizado_por: ctx.id }));
    const novo = __spreadProps(__spreadValues({}, doacao), { situacao, analisado_por: ctx.id, analisado_em: agora, justificativa: (_c = corpo.justificativa) != null ? _c : "", retirar_ate: retirarAte, versao: Number(doacao.versao) + 1, atualizado_por: ctx.id });
    const salvo = gravar(tx, colecao("doacao"), novo);
    auditar(tx, { colecao: "doacao", registro_id: id, acao: "analisar", antes: { situacao: doacao.situacao }, depois: { situacao, itens: aprovados.map((a) => ({ item: a.item.id, aprovada: a.qtd })), reservas: plano.reservas }, usuario_id: ctx.id });
    resultado2 = { doacao: paraObjeto(colecao("doacao"), salvo), reservas: plano.reservas };
  });
  return resultado2;
}
function expirarPrazos(app, hoje = hojeISO()) {
  let reservas = 0;
  let pedidos = 0;
  app.runInTransaction((tx) => {
    const dia3 = hoje.slice(0, 10);
    for (const r2 of todos(tx, "reserva")) {
      if (r2.situacao === "ativa" && r2.valida_ate && String(r2.valida_ate).slice(0, 10) < dia3) {
        gravar(tx, colecao("reserva"), __spreadProps(__spreadValues({}, r2), { situacao: "expirada", versao: Number(r2.versao) + 1 }));
        reservas++;
      }
    }
    for (const d2 of todos(tx, "doacao")) {
      if (SITUACOES_APROVADAS.includes(String(d2.situacao)) && d2.retirar_ate && String(d2.retirar_ate).slice(0, 10) < dia3) {
        gravar(tx, colecao("doacao"), __spreadProps(__spreadValues({}, d2), { situacao: "expirada", versao: Number(d2.versao) + 1 }));
        auditar(tx, { colecao: "doacao", registro_id: d2.id, acao: "expirar", antes: { situacao: d2.situacao }, depois: { situacao: "expirada" }, usuario_id: "sistema" });
        pedidos++;
      }
    }
  });
  return { reservas, pedidos };
}
function todos(app, nome) {
  const col = colecao(nome);
  return app.findRecordsByFilter(nome, "excluido = false", "", 0, 0).map((r2) => paraObjeto(col, r2));
}
function dadosCatalogo(app) {
  return {
    especies: todos(app, "especie"),
    nomesPopulares: todos(app, "nome_popular"),
    viveiros: todos(app, "viveiro"),
    lotesMudas: todos(app, "lote_mudas"),
    movimentos: todos(app, "movimento_estoque_mudas"),
    reservas: todos(app, "reserva"),
    fotos: todos(app, "especie_foto")
  };
}
function catalogoPublico(app) {
  return { itens: montarCatalogo(dadosCatalogo(app)), gerado_em: (/* @__PURE__ */ new Date()).toISOString() };
}
function rastreioDe(app, lote, cache = {}) {
  const pegar = (n2) => {
    var _a;
    return (_a = cache[n2]) != null ? _a : cache[n2] = todos(app, n2);
  };
  return montarRastreio(lote, {
    viveiros: pegar("viveiro"),
    lotesSementes: pegar("lote_sementes"),
    ligacoes: pegar("lote_sementes_coleta"),
    coletas: pegar("coleta"),
    matrizes: pegar("matriz"),
    municipios: pegar("municipio")
  });
}
function especiePublica(app, id) {
  const d2 = dadosCatalogo(app);
  const e = d2.especies.find((x) => x.id === id);
  if (!e || !e.publicada || e.ficticia) throw new Error("Esp\xE9cie n\xE3o encontrada no cat\xE1logo.");
  const disp = disponivelPorLote(d2);
  const viveiros = new Map(d2.viveiros.map((v) => [v.id, String(v.nome)]));
  const cache = { viveiro: d2.viveiros };
  const lotes = d2.lotesMudas.filter((l) => {
    var _a;
    return l.especie_id === id && ((_a = disp.get(l.id)) != null ? _a : 0) > 0;
  }).map((l) => {
    var _a;
    return { disponivel: disp.get(l.id), viveiro: (_a = viveiros.get(String(l.viveiro_id))) != null ? _a : "", rastreio: rastreioDe(app, l, cache) };
  });
  return {
    ficha: fichaPublica(e),
    nomes_populares: d2.nomesPopulares.filter((n2) => n2.especie_id === id).map((n2) => String(n2.nome)),
    fotos: d2.fotos.filter((f) => f.especie_id === id && f.arquivo).map((f) => {
      var _a;
      return { id: f.id, parte: f.parte, arquivo: f.arquivo, miniatura: f.miniatura, credito: (_a = f.credito) != null ? _a : "" };
    }),
    lotes
  };
}
function transparencia(app) {
  const t2 = (n2) => todos(app, n2);
  return __spreadProps(__spreadValues({}, montarTransparencia({
    viveiros: [],
    especies: t2("especie"),
    nomesPopulares: t2("nome_popular"),
    matrizes: [],
    coletas: [],
    lotesSementes: [],
    ligacoes: [],
    movSementes: [],
    lotesMudas: [],
    eventosMudas: [],
    movMudas: [],
    doacoes: t2("doacao"),
    doacaoItens: t2("doacao_item"),
    doacaoItemLotes: [],
    historicoProgramas: t2("doacao_programa_historico"),
    plantios: t2("plantio"),
    plantioItens: t2("plantio_item"),
    monitoramentos: t2("monitoramento"),
    monitoramentoItens: t2("monitoramento_item")
  })), {
    gerado_em: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function rastreioPublico(app, codigo) {
  let rec;
  try {
    rec = app.findFirstRecordByFilter("lote_mudas", "codigo = {:c} && excluido = false", { c: codigo.trim().toUpperCase() });
  } catch (e) {
    throw new Error("Lote n\xE3o encontrado.");
  }
  return rastreioDe(app, paraObjeto(colecao("lote_mudas"), rec));
}
var NOMES = new Set(COLECOES.map((c) => c.nome));
function antesDeGravarPeloPainel(app, rec, criando) {
  const nome = rec.collection().name;
  if (!NOMES.has(nome)) return;
  if (criando && !rec.id) rec.set("id", novoId());
  rec.set("versao", rec.getInt("versao") + 1);
  rec.set("seq", proximoSeq(app));
}
function auditarPainel(app, rec, acao, quem) {
  const nome = rec.collection().name;
  if (!NOMES.has(nome)) return;
  auditar(app, { colecao: nome, registro_id: rec.id, acao: `${acao}_painel`, antes: null, depois: paraObjeto(colecao(nome), rec), usuario_id: quem });
}
var COLECOES_SINCRONIZADAS = COLECOES.map((c) => c.nome);
