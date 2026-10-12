/**
 * Lógica do servidor que roda dentro do PocketBase (pb_hooks).
 *
 * Este arquivo é empacotado junto com o domínio em pb_hooks/lib/crads.js.
 * Só usa a API JS do PocketBase ($app, Record…); nada de Node.
 */
import {
  COLECOES,
  TIPOS_COM_ANO,
  colecao,
  disponivelPorLote,
  parametro,
  planejarReservas,
  matrizDe,
  prazoRetirada,
  temPermissao,
  situacaoAposAnalise,
  SITUACOES_APROVADAS,
  SITUACOES_EM_ANALISE,
  existeColecao,
  fichaPublica,
  montarCatalogo,
  montarTransparencia,
  montarRastreio,
  formatarCodigo,
  montarRecebimento,
  nomesCampos,
  podeEscrever,
  proximoCodigoLoteMudas,
  resolverOperacao,
  viveirosVisiveis,
  type Colecao,
  type ContextoUsuario,
  type DadosCatalogo,
  type FaixaCodigo,
  type Operacao,
  type Perfil,
  type PortaServidor,
  type Registro,
  type ResultadoOperacao,
} from '../../dominio/src/index';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const $app: any;
declare const $security: any;
declare const Record: any;

type App = any;
type RecordPB = any;

const ALFABETO_ID = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CONTROLE = ['versao', 'seq', 'excluido', 'criado_por', 'atualizado_por', 'dispositivo_id', 'criado_no_aparelho_em'];
const ID_CONTADOR = 'contadorglobal1';
const LIMITE_RECEBIMENTO = 500;

const novoId = (): string => $security.randomStringWithAlphabet(15, ALFABETO_ID);

// ---------------------------------------------------------------------------
// leitura e gravação de registros

function buscar(app: App, col: string, id: string): RecordPB | null {
  try {
    return app.findRecordById(col, id);
  } catch {
    return null;
  }
}

/** Converte um Record do PocketBase em objeto simples, só com os campos do esquema. */
export function paraObjeto(col: Colecao, rec: RecordPB): Registro {
  const bruto = JSON.parse(JSON.stringify(rec));
  const o: Registro = { id: bruto.id, versao: bruto.versao ?? 0 };
  for (const k of [...nomesCampos(col), ...CONTROLE, 'created', 'updated']) if (k in bruto) o[k] = bruto[k];
  return o;
}

function proximoSeq(app: App): number {
  let rec = buscar(app, 'sync_contador', ID_CONTADOR);
  if (!rec) {
    rec = new Record(app.findCollectionByNameOrId('sync_contador'));
    rec.set('id', ID_CONTADOR);
    rec.set('valor', 0);
  }
  const valor = (rec.getInt('valor') as number) + 1;
  rec.set('valor', valor);
  app.save(rec);
  return valor;
}

function gravar(app: App, col: Colecao, reg: Registro): RecordPB {
  let rec = buscar(app, col.nome, reg.id);
  if (!rec) {
    rec = new Record(app.findCollectionByNameOrId(col.nome));
    rec.set('id', reg.id);
  }
  const arquivos = new Set(col.campos.filter((c) => c.tipo === 'arquivo').map((c) => c.nome));
  for (const k of [...nomesCampos(col), ...CONTROLE]) {
    if (k === 'seq' || arquivos.has(k) || !(k in reg)) continue;
    const v = reg[k];
    rec.set(k, v === undefined ? null : v);
  }
  rec.set('seq', proximoSeq(app));
  app.save(rec);
  return rec;
}

function auditar(app: App, dados: { colecao: string; registro_id: string; acao: string; antes: unknown; depois: unknown; usuario_id: string; dispositivo_id?: string; data_aparelho?: string }) {
  const rec = new Record(app.findCollectionByNameOrId('auditoria'));
  rec.set('id', novoId());
  for (const [k, v] of Object.entries(dados)) rec.set(k, v ?? null);
  app.save(rec);
}

// ---------------------------------------------------------------------------
// usuário

export function contextoDe(app: App, auth: RecordPB): ContextoUsuario {
  const perfisPorViveiro: Record<string, Perfil[]> = {};
  const vinculos = app.findRecordsByFilter('usuario_viveiro', 'usuario_id = {:u} && excluido = false', '', 0, 0, { u: auth.id });
  for (const v of vinculos) {
    const viv = v.getString('viveiro_id');
    (perfisPorViveiro[viv] ??= []).push(v.getString('perfil') as Perfil);
  }
  return {
    id: auth.id,
    gestorGeral: !!auth.getBool('gestor_geral'),
    solicitante: !!auth.getBool('solicitante'),
    perfisPorViveiro,
    permissoes: matrizDe(todos(app, 'parametro')),
  };
}

// ---------------------------------------------------------------------------
// códigos

function reservarNumeros(app: App, tipo: string, ano: number, quantidade: number): { inicio: number; fim: number } {
  let seq: RecordPB;
  try {
    seq = app.findFirstRecordByFilter('sequencia_codigo', 'tipo = {:t} && ano = {:a}', { t: tipo, a: ano });
  } catch {
    seq = new Record(app.findCollectionByNameOrId('sequencia_codigo'));
    seq.set('id', novoId());
    seq.set('tipo', tipo);
    seq.set('ano', ano);
    seq.set('proximo', 1);
  }
  const inicio = seq.getInt('proximo') as number;
  seq.set('proximo', inicio + quantidade);
  app.save(seq);
  return { inicio, fim: inicio + quantidade - 1 };
}

function anoDe(reg: Registro): number {
  const s = String(reg.criado_no_aparelho_em ?? '');
  const ano = Number(s.slice(0, 4));
  return ano > 2000 ? ano : new Date().getFullYear();
}

function porta(app: App, dispositivoId: string): PortaServidor {
  return {
    codigoEmUso(col, codigo, excetoId) {
      try {
        app.findFirstRecordByFilter(col, 'codigo = {:c} && id != {:i}', { c: codigo, i: excetoId });
        return true;
      } catch {
        return false;
      }
    },
    novoCodigo(col, reg) {
      if (col.prefixoCodigo === 'LM') {
        const ls = buscar(app, 'lote_sementes', String(reg.lote_sementes_id));
        if (!ls) throw new Error('lote de sementes do lote de mudas não encontrado');
        const codLS = ls.getString('codigo');
        const irmaos = app.findRecordsByFilter('lote_mudas', 'codigo ~ {:p}', '', 0, 0, { p: codLS.replace('LS-', 'LM-') + '-' });
        return proximoCodigoLoteMudas(codLS, irmaos.map((r: RecordPB) => r.getString('codigo')));
      }
      const tipo = col.prefixoCodigo as FaixaCodigo['tipo'];
      const ano = TIPOS_COM_ANO.has(tipo) ? anoDe(reg) : 0;
      return formatarCodigo(tipo, ano, reservarNumeros(app, tipo, ano, 1).inicio);
    },
    faixasDoDispositivo(id) {
      return app.findRecordsByFilter('faixa_codigo', 'dispositivo_id = {:d}', '', 0, 0, { d: id || dispositivoId }).map((r: RecordPB) => ({
        tipo: r.getString('tipo'),
        ano: r.getInt('ano'),
        inicio: r.getInt('inicio'),
        fim: r.getInt('fim'),
        ultimo: r.getInt('inicio') - 1,
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// rotas

/** POST /api/crads/sync/enviar — aplica as operações da fila do aparelho. */
export function enviar(app: App, auth: RecordPB, corpo: { dispositivo_id?: string; operacoes?: Operacao[] }) {
  const ctx = contextoDe(app, auth);
  const dispositivo = String(corpo.dispositivo_id ?? '');
  const resultados: ResultadoOperacao[] = [];

  for (const op of corpo.operacoes ?? []) {
    let res: ResultadoOperacao | null = null;
    try {
      app.runInTransaction((tx: App) => {
        // Operação já recebida antes (reenvio): devolve o mesmo resultado.
        try {
          const feita = tx.findFirstRecordByFilter('sync_op', 'op_id = {:o}', { o: op.op_id });
          const anterior = JSON.parse(JSON.stringify(feita)).resultado as ResultadoOperacao;
          const atual = existeColecao(op.colecao) ? buscar(tx, op.colecao, op.registro_id) : null;
          res = { ...anterior, registro: atual ? paraObjeto(colecao(op.colecao), atual) : anterior.registro };
          return;
        } catch {
          /* operação nova */
        }

        const col = existeColecao(op.colecao) ? colecao(op.colecao) : null;
        const atualRec = col ? buscar(tx, col.nome, op.registro_id) : null;
        const atual = col && atualRec ? paraObjeto(col, atualRec) : null;
        const opSegura: Operacao = { ...op, dispositivo_id: dispositivo || op.dispositivo_id };
        const d = resolverOperacao(opSegura, atual, ctx, porta(tx, dispositivo));

        if (col && d.gravar) {
          const salvo = gravar(tx, col, d.gravar);
          d.resultado.registro = paraObjeto(col, salvo);
        }
        if (d.auditoria) {
          auditar(tx, {
            colecao: op.colecao,
            registro_id: op.registro_id,
            acao: d.auditoria.acao,
            antes: d.auditoria.antes,
            depois: d.auditoria.depois,
            usuario_id: ctx.id,
            dispositivo_id: opSegura.dispositivo_id,
            data_aparelho: op.criado_no_aparelho_em,
          });
        }
        if (d.conflitos.length) {
          gravar(tx, colecao('conflito'), {
            id: novoId(),
            versao: 1,
            excluido: false,
            colecao: op.colecao,
            registro_id: op.registro_id,
            campos: d.conflitos,
            usuario_id: ctx.id,
            situacao: 'aberto',
            criado_por: ctx.id,
            atualizado_por: ctx.id,
            dispositivo_id: opSegura.dispositivo_id,
            criado_no_aparelho_em: op.criado_no_aparelho_em,
          });
        }
        // Rejeições não são memorizadas: o aparelho pode corrigir e reenviar.
        if (d.resultado.status !== 'rejeitada') {
          const s = new Record(tx.findCollectionByNameOrId('sync_op'));
          s.set('id', novoId());
          s.set('op_id', op.op_id);
          s.set('usuario_id', ctx.id);
          s.set('resultado', { ...d.resultado, registro: undefined });
          tx.save(s);
        }
        res = d.resultado;
      });
    } catch (err) {
      res = { op_id: op.op_id, colecao: op.colecao, registro_id: op.registro_id, status: 'rejeitada', motivo: `erro no servidor: ${String(err)}` };
    }
    resultados.push(res!);
  }

  registrarDispositivo(app, dispositivo, ctx.id, 'ultimo_envio');
  return { resultados };
}

/** GET /api/crads/sync/receber?desde=N — registros alterados depois do cursor. */
export function receber(app: App, auth: RecordPB, desde: number, limite = LIMITE_RECEBIMENTO, dispositivo = '') {
  const ctx = contextoDe(app, auth);
  const lim = Math.max(1, Math.min(limite, 2000));
  const viveiros = viveirosVisiveis(ctx);
  const filtroViveiro = viveiros === null ? '' : viveiros.length ? '(' + viveiros.map((_, i) => `viveiro_id = {:v${i}}`).join(' || ') + ')' : '';
  const params: Record<string, unknown> = { desde, eu: ctx.id };
  (viveiros ?? []).forEach((v, i) => (params[`v${i}`] = v));

  const porColecao: { colecao: Colecao; registros: Registro[] }[] = [];
  for (const col of COLECOES) {
    let filtro = 'seq > {:desde}';
    if (col.porViveiro && viveiros !== null) {
      const partes: string[] = [];
      if (filtroViveiro) partes.push(filtroViveiro);
      if (ctx.solicitante && col.campoDono) partes.push(`${col.campoDono} = {:eu}`);
      if (!partes.length) continue;
      filtro += ` && (${partes.join(' || ')})`;
    }
    const recs = app.findRecordsByFilter(col.nome, filtro, 'seq', lim + 1, 0, params);
    porColecao.push({ colecao: col, registros: recs.map((r: RecordPB) => paraObjeto(col, r)) });
  }
  if (dispositivo) registrarDispositivo(app, dispositivo, ctx.id, 'ultimo_recebimento');
  return montarRecebimento(porColecao, ctx, desde, lim);
}

/** POST /api/crads/sync/faixas — reserva faixas de código para o aparelho (pacote de campo). */
export function reservarFaixas(app: App, auth: RecordPB, corpo: { dispositivo_id?: string; pedidos?: { tipo: string; ano?: number; quantidade?: number }[] }) {
  const ctx = contextoDe(app, auth);
  const dispositivo = String(corpo.dispositivo_id ?? '');
  if (!/^[a-z0-9]{15}$/.test(dispositivo)) throw new Error('dispositivo_id inválido');
  const faixas: FaixaCodigo[] = [];
  app.runInTransaction((tx: App) => {
    for (const p of corpo.pedidos ?? []) {
      if (!['MT', 'LS', 'DO'].includes(p.tipo)) throw new Error(`tipo de código inválido: ${p.tipo}`);
      const tipo = p.tipo as FaixaCodigo['tipo'];
      const ano = TIPOS_COM_ANO.has(tipo) ? Number(p.ano) || new Date().getFullYear() : 0;
      const qtd = Math.max(1, Math.min(Number(p.quantidade) || 20, 200));
      const { inicio, fim } = reservarNumeros(tx, tipo, ano, qtd);
      const rec = new Record(tx.findCollectionByNameOrId('faixa_codigo'));
      rec.set('id', novoId());
      for (const [k, v] of Object.entries({ dispositivo_id: dispositivo, usuario_id: ctx.id, tipo, ano, inicio, fim })) rec.set(k, v);
      tx.save(rec);
      faixas.push({ tipo, ano, inicio, fim, ultimo: inicio - 1 });
    }
  });
  registrarDispositivo(app, dispositivo, ctx.id, '');
  return { faixas };
}

/** GET /api/crads/eu — quem sou eu, meus perfis e viveiros. */
export function eu(app: App, auth: RecordPB) {
  const ctx = contextoDe(app, auth);
  const viveiros = new Map(todos(app, 'viveiro').map((v) => [v.id, String(v.nome)]));
  const pedidos = app
    .findRecordsByFilter('pedido_acesso', 'usuario_id = {:u} && excluido = false', '-created', 5, 0, { u: auth.id })
    .map((r: RecordPB) => ({ perfil: r.getString('perfil'), viveiro: viveiros.get(r.getString('viveiro_id')) ?? '', situacao: r.getString('situacao'), motivo: r.getString('motivo') }));
  return { ...ctx, nome: auth.getString('name'), email: auth.getString('email'), pedidos_acesso: pedidos };
}

/** POST /api/crads/arquivo/{colecao}/{id}/{campo} — envia foto, assinatura ou PDF. */
export function receberArquivo(app: App, auth: RecordPB, nomeCol: string, id: string, campo: string, arquivos: unknown[], dispositivo = '') {
  if (!existeColecao(nomeCol)) throw new Error('coleção desconhecida');
  const col = colecao(nomeCol);
  if (!col.campos.some((c) => c.nome === campo && c.tipo === 'arquivo')) throw new Error('campo de arquivo desconhecido');
  if (!arquivos.length) throw new Error('nenhum arquivo enviado');
  const ctx = contextoDe(app, auth);
  let registro: Registro | null = null;
  app.runInTransaction((tx: App) => {
    const rec = buscar(tx, nomeCol, id);
    if (!rec) throw new Error('registro ainda não sincronizado');
    if (!podeEscrever(ctx, col, paraObjeto(col, rec))) throw new Error('sem permissão');
    rec.set(campo, arquivos[0]);
    rec.set('seq', proximoSeq(tx));
    tx.save(rec);
    auditar(tx, { colecao: nomeCol, registro_id: id, acao: 'arquivo', antes: null, depois: { campo, arquivo: rec.getString(campo) }, usuario_id: ctx.id, dispositivo_id: dispositivo });
    registro = paraObjeto(col, rec);
  });
  return { registro };
}

function registrarDispositivo(app: App, id: string, usuarioId: string, campo: string) {
  if (!/^[a-z0-9]{15}$/.test(id)) return;
  try {
    let rec = buscar(app, 'dispositivo', id);
    if (!rec) {
      rec = new Record(app.findCollectionByNameOrId('dispositivo'));
      rec.set('id', id);
    }
    rec.set('usuario_id', usuarioId);
    if (campo) rec.set(campo, new Date().toISOString());
    app.save(rec);
  } catch {
    /* registrar o aparelho nunca deve derrubar a sincronização */
  }
}

// ---------------------------------------------------------------------------
// contas e equipe

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS_EQUIPE = ['coletor', 'viveirista', 'gestor'];

function controle(usuarioId: string, viveiroId: string) {
  return { versao: 1, excluido: false, criado_por: usuarioId, atualizado_por: usuarioId, criado_no_aparelho_em: hojeISO(), viveiro_id: viveiroId };
}

function usuarioPorEmail(app: App, email: string): RecordPB | null {
  try {
    return app.findAuthRecordByEmail('users', email);
  } catch {
    return null;
  }
}

function novoUsuario(app: App, d: { nome: string; email: string; senha: string; solicitante: boolean }): RecordPB {
  const u = new Record(app.findCollectionByNameOrId('users'));
  u.setEmail(d.email);
  u.setPassword(d.senha);
  u.set('name', d.nome);
  u.set('solicitante', d.solicitante);
  app.save(u);
  return u;
}

function validarConta(d: { nome?: string; email?: string; senha?: string }) {
  const nome = String(d.nome ?? '').trim();
  const email = String(d.email ?? '').trim().toLowerCase();
  const senha = String(d.senha ?? '');
  if (nome.length < 3) throw new Error('Escreva o nome completo.');
  if (!EMAIL_OK.test(email)) throw new Error('E-mail inválido.');
  if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 letras ou números.');
  return { nome, email, senha };
}

function viveiroAtivo(app: App, id: string) {
  const v = buscar(app, 'viveiro', id);
  if (!v || v.getBool('excluido') || v.getBool('ativo') === false) throw new Error('Escolha um viveiro.');
  return v;
}

/** GET /api/crads/publico/viveiros — para escolher o viveiro ao criar a conta. */
export function viveirosPublicos(app: App) {
  return todos(app, 'viveiro')
    .filter((v) => v.ativo !== false)
    .map((v) => ({ id: v.id, nome: String(v.nome), sigla: String(v.sigla ?? '') }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * POST /api/crads/conta — a própria pessoa cria a conta pelo celular.
 * Solicitante entra na hora; coletor e viveirista ficam aguardando o gestor.
 */
export function criarConta(app: App, corpo: { nome?: string; email?: string; senha?: string; perfil?: string; viveiro_id?: string }) {
  const d = validarConta(corpo);
  const perfil = String(corpo.perfil ?? 'solicitante');
  if (!['solicitante', 'coletor', 'viveirista'].includes(perfil)) throw new Error('Perfil inválido.');
  // Freio contra robôs: no máximo 30 contas novas por hora no servidor todo.
  const umaHora = new Date(Date.now() - 3600_000).toISOString().replace('T', ' ');
  if (app.findRecordsByFilter('users', 'created >= {:t}', '', 31, 0, { t: umaHora }).length > 30) throw new Error('Muitos cadastros agora. Tente de novo mais tarde.');
  let pendente = false;
  app.runInTransaction((tx: App) => {
    if (usuarioPorEmail(tx, d.email)) throw new Error('Este e-mail já tem conta. Toque em Entrar.');
    const u = novoUsuario(tx, { ...d, solicitante: perfil === 'solicitante' });
    if (perfil !== 'solicitante') {
      const viveiroId = String(corpo.viveiro_id ?? '');
      viveiroAtivo(tx, viveiroId);
      const pedido = { id: novoId(), ...controle(u.id, viveiroId), usuario_id: u.id, nome: d.nome, email: d.email, perfil, situacao: 'pendente' };
      gravar(tx, colecao('pedido_acesso'), pedido);
      auditar(tx, { colecao: 'pedido_acesso', registro_id: pedido.id, acao: 'criar', antes: null, depois: pedido, usuario_id: u.id });
      pendente = true;
    }
  });
  return { ok: true, pendente };
}

/** Viveiros em que o usuário pode cuidar da equipe (null = todos). */
function viveirosDaEquipe(ctx: ContextoUsuario): string[] | null {
  if (ctx.gestorGeral) return null;
  return Object.keys(ctx.perfisPorViveiro).filter((v) => temPermissao(ctx, 'equipe', v));
}

function exigirEquipe(ctx: ContextoUsuario, viveiroId: string) {
  if (!temPermissao(ctx, 'equipe', viveiroId)) throw new Error('Você não tem permissão para cuidar da equipe deste viveiro.');
}

function exigirPodeDarPerfil(ctx: ContextoUsuario, viveiroId: string, perfil: string) {
  if (!PERFIS_EQUIPE.includes(perfil)) throw new Error('Perfil inválido.');
  // Só gestor dá o perfil de gestor (ninguém se promove por tabela de permissões).
  if (perfil === 'gestor' && !ctx.gestorGeral && !(ctx.perfisPorViveiro[viveiroId] ?? []).includes('gestor')) throw new Error('Só um gestor pode cadastrar outro gestor.');
}

/** GET /api/crads/equipe — pessoas e pedidos de acesso dos viveiros do gestor. */
export function equipe(app: App, auth: RecordPB) {
  const ctx = contextoDe(app, auth);
  const meus = viveirosDaEquipe(ctx);
  if (meus && !meus.length) throw new Error('Você não tem permissão para cuidar da equipe.');
  const dentro = (v: unknown) => !meus || meus.includes(String(v));
  const viveiros = todos(app, 'viveiro').filter((v) => dentro(v.id)).map((v) => ({ id: v.id, nome: String(v.nome) }));
  const vinculos = todos(app, 'usuario_viveiro').filter((v) => dentro(v.viveiro_id));
  const pedidos = todos(app, 'pedido_acesso').filter((p) => dentro(p.viveiro_id) && p.situacao === 'pendente');
  const pessoas = new Map<string, { usuario_id: string; nome: string; email: string; vinculos: { id: string; viveiro_id: string; perfil: string }[] }>();
  for (const v of vinculos) {
    const id = String(v.usuario_id);
    let p = pessoas.get(id);
    if (!p) {
      const u = buscar(app, 'users', id);
      p = { usuario_id: id, nome: u ? u.getString('name') : '', email: u ? u.getString('email') : '', vinculos: [] };
      pessoas.set(id, p);
    }
    p.vinculos.push({ id: v.id, viveiro_id: String(v.viveiro_id), perfil: String(v.perfil) });
  }
  return {
    viveiros,
    pedidos: pedidos.map((p) => ({ id: p.id, nome: p.nome, email: p.email, perfil: p.perfil, viveiro_id: p.viveiro_id, criado: p.created })),
    pessoas: [...pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

function vincular(tx: App, ctx: ContextoUsuario, usuarioId: string, viveiroId: string, perfil: string) {
  const ja = todos(tx, 'usuario_viveiro').some((v) => v.usuario_id === usuarioId && v.viveiro_id === viveiroId && v.perfil === perfil);
  if (ja) return;
  const reg = { id: novoId(), ...controle(ctx.id, viveiroId), usuario_id: usuarioId, perfil };
  gravar(tx, colecao('usuario_viveiro'), reg);
  auditar(tx, { colecao: 'usuario_viveiro', registro_id: reg.id, acao: 'criar', antes: null, depois: reg, usuario_id: ctx.id });
}

/** POST /api/crads/equipe/pessoa — o gestor cadastra alguém (ou dá mais um perfil a quem já tem conta). */
export function equipeCadastrar(app: App, auth: RecordPB, corpo: { nome?: string; email?: string; senha?: string; viveiro_id?: string; perfil?: string }) {
  const ctx = contextoDe(app, auth);
  const viveiroId = String(corpo.viveiro_id ?? '');
  const perfil = String(corpo.perfil ?? '');
  exigirEquipe(ctx, viveiroId);
  exigirPodeDarPerfil(ctx, viveiroId, perfil);
  let criada = false;
  app.runInTransaction((tx: App) => {
    viveiroAtivo(tx, viveiroId);
    const email = String(corpo.email ?? '').trim().toLowerCase();
    let u = EMAIL_OK.test(email) ? usuarioPorEmail(tx, email) : null;
    if (!u) {
      u = novoUsuario(tx, { ...validarConta(corpo), solicitante: false });
      criada = true;
    }
    vincular(tx, ctx, u.id, viveiroId, perfil);
  });
  return { ok: true, conta_nova: criada };
}

/** POST /api/crads/equipe/pedido/{id} — aprova ou recusa um pedido de acesso. */
export function equipeResponder(app: App, auth: RecordPB, id: string, corpo: { aprovar?: boolean; motivo?: string; perfil?: string }) {
  const ctx = contextoDe(app, auth);
  app.runInTransaction((tx: App) => {
    const rec = buscar(tx, 'pedido_acesso', id);
    if (!rec || rec.getBool('excluido')) throw new Error('Pedido não encontrado.');
    const pedido = paraObjeto(colecao('pedido_acesso'), rec);
    const viveiroId = String(pedido.viveiro_id);
    exigirEquipe(ctx, viveiroId);
    if (pedido.situacao !== 'pendente') throw new Error('Este pedido já foi respondido.');
    const perfil = String(corpo.perfil || pedido.perfil);
    if (corpo.aprovar) {
      exigirPodeDarPerfil(ctx, viveiroId, perfil);
      vincular(tx, ctx, String(pedido.usuario_id), viveiroId, perfil);
    }
    const novo = { ...pedido, situacao: corpo.aprovar ? 'aprovado' : 'recusado', analisado_por: ctx.id, motivo: String(corpo.motivo ?? ''), versao: Number(pedido.versao) + 1, atualizado_por: ctx.id };
    gravar(tx, colecao('pedido_acesso'), novo);
    auditar(tx, { colecao: 'pedido_acesso', registro_id: id, acao: corpo.aprovar ? 'aprovar' : 'recusar', antes: { situacao: 'pendente' }, depois: { situacao: novo.situacao, perfil }, usuario_id: ctx.id });
  });
  return { ok: true };
}

/** POST /api/crads/equipe/vinculo/{id}/remover — tira o acesso da pessoa a um viveiro. */
export function equipeRemover(app: App, auth: RecordPB, id: string) {
  const ctx = contextoDe(app, auth);
  app.runInTransaction((tx: App) => {
    const rec = buscar(tx, 'usuario_viveiro', id);
    if (!rec || rec.getBool('excluido')) throw new Error('Acesso não encontrado.');
    const v = paraObjeto(colecao('usuario_viveiro'), rec);
    exigirEquipe(ctx, String(v.viveiro_id));
    if (v.usuario_id === ctx.id) throw new Error('Você não pode tirar o próprio acesso.');
    if (v.perfil === 'gestor') exigirPodeDarPerfil(ctx, String(v.viveiro_id), 'gestor');
    gravar(tx, colecao('usuario_viveiro'), { ...v, excluido: true, versao: Number(v.versao) + 1, atualizado_por: ctx.id });
    auditar(tx, { colecao: 'usuario_viveiro', registro_id: id, acao: 'excluir', antes: v, depois: { excluido: true }, usuario_id: ctx.id });
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// doação: análise com reservas (só com internet) e expiração dos prazos

const hojeISO = () => new Date().toISOString();

function lerParametro<T>(app: App, chave: string, viveiroId?: string): T {
  return parametro<T>(todos(app, 'parametro'), chave, viveiroId);
}

/**
 * POST /api/crads/doacao/{id}/analisar — aprova (toda ou em parte) ou nega.
 * Ao aprovar, reserva as mudas dos lotes prontos mais antigos, numa transação:
 * dois aprovadores ao mesmo tempo nunca reservam a mesma muda.
 */
export function analisarDoacao(app: App, auth: RecordPB, id: string, corpo: { itens?: { item_id: string; qtd_aprovada: number }[]; justificativa?: string }) {
  const ctx = contextoDe(app, auth);
  let resultado: unknown = null;
  app.runInTransaction((tx: App) => {
    const docRec = buscar(tx, 'doacao', id);
    if (!docRec) throw new Error('Pedido não encontrado.');
    const doacao = paraObjeto(colecao('doacao'), docRec);
    if (!SITUACOES_EM_ANALISE.includes(String(doacao.situacao))) throw new Error('Este pedido não está aguardando análise.');
    const viveiroId = String(doacao.viveiro_id);
    if (!temPermissao(ctx, 'aprovar_doacao', viveiroId)) throw new Error('Você não tem permissão para aprovar pedidos de mudas.');

    const itens = tx.findRecordsByFilter('doacao_item', 'doacao_id = {:d} && excluido = false', '', 0, 0, { d: id }).map((r: RecordPB) => paraObjeto(colecao('doacao_item'), r));
    const pedidoAprovado = new Map((corpo.itens ?? []).map((i) => [i.item_id, Number(i.qtd_aprovada)]));
    for (const [itemId, q] of pedidoAprovado) {
      const item = itens.find((i: Registro) => i.id === itemId);
      if (!item) throw new Error('Item do pedido não encontrado.');
      if (!Number.isInteger(q) || q < 0 || q > Number(item.qtd_pedida)) throw new Error('Quantidade aprovada inválida.');
    }
    const aprovados = itens.map((i: Registro) => ({ item: i, qtd: pedidoAprovado.get(i.id) ?? 0 }));
    const situacao = situacaoAposAnalise(aprovados.map((a: { item: Registro; qtd: number }) => ({ qtd_pedida: Number(a.item.qtd_pedida), qtd_aprovada: a.qtd })));
    if (situacao === 'negada' && !String(corpo.justificativa ?? '').trim()) throw new Error('Diga o motivo da recusa.');

    // Disponível de cada lote pronto do viveiro (saldo − reservas ativas).
    const doViveiro = (n: string) => todos(tx, n).filter((r) => r.viveiro_id === viveiroId);
    const lotes = doViveiro('lote_mudas');
    const disp = disponivelPorLote({ lotesMudas: lotes, movimentos: doViveiro('movimento_estoque_mudas'), reservas: doViveiro('reserva') });
    const plano = planejarReservas(
      aprovados.filter((a: { qtd: number }) => a.qtd > 0).map((a: { item: Registro; qtd: number }) => ({ doacao_item_id: a.item.id, especie_id: String(a.item.especie_id), quantidade: a.qtd })),
      lotes.filter((l) => disp.has(l.id)).map((l) => ({ id: l.id, especie_id: String(l.especie_id), data_semeadura: String(l.data_semeadura ?? ''), disponivel: disp.get(l.id) ?? 0 })),
    );
    if ('erro' in plano) throw new Error(plano.erro);

    const agora = hojeISO();
    const retirarAte = situacao === 'negada' ? null : prazoRetirada(agora, lerParametro<number>(tx, 'prazo_retirada_dias', viveiroId));
    const controle = { versao: 1, excluido: false, criado_por: ctx.id, atualizado_por: ctx.id, criado_no_aparelho_em: agora, viveiro_id: viveiroId };
    for (const r of plano.reservas) gravar(tx, colecao('reserva'), { id: novoId(), ...controle, ...r, valida_ate: retirarAte, situacao: 'ativa' });
    for (const a of aprovados) gravar(tx, colecao('doacao_item'), { ...a.item, qtd_aprovada: a.qtd, versao: Number(a.item.versao) + 1, atualizado_por: ctx.id });
    const novo = { ...doacao, situacao, analisado_por: ctx.id, analisado_em: agora, justificativa: corpo.justificativa ?? '', retirar_ate: retirarAte, versao: Number(doacao.versao) + 1, atualizado_por: ctx.id };
    const salvo = gravar(tx, colecao('doacao'), novo);
    auditar(tx, { colecao: 'doacao', registro_id: id, acao: 'analisar', antes: { situacao: doacao.situacao }, depois: { situacao, itens: aprovados.map((a: { item: Registro; qtd: number }) => ({ item: a.item.id, aprovada: a.qtd })), reservas: plano.reservas }, usuario_id: ctx.id });
    resultado = { doacao: paraObjeto(colecao('doacao'), salvo), reservas: plano.reservas };
  });
  return resultado;
}

/** Reservas e pedidos com prazo vencido (roda todo dia e pode ser chamada à mão). */
export function expirarPrazos(app: App, hoje = hojeISO()) {
  let reservas = 0;
  let pedidos = 0;
  app.runInTransaction((tx: App) => {
    const dia = hoje.slice(0, 10);
    for (const r of todos(tx, 'reserva')) {
      if (r.situacao === 'ativa' && r.valida_ate && String(r.valida_ate).slice(0, 10) < dia) {
        gravar(tx, colecao('reserva'), { ...r, situacao: 'expirada', versao: Number(r.versao) + 1 });
        reservas++;
      }
    }
    for (const d of todos(tx, 'doacao')) {
      if (SITUACOES_APROVADAS.includes(String(d.situacao)) && d.retirar_ate && String(d.retirar_ate).slice(0, 10) < dia) {
        gravar(tx, colecao('doacao'), { ...d, situacao: 'expirada', versao: Number(d.versao) + 1 });
        auditar(tx, { colecao: 'doacao', registro_id: d.id, acao: 'expirar', antes: { situacao: d.situacao }, depois: { situacao: 'expirada' }, usuario_id: 'sistema' });
        pedidos++;
      }
    }
  });
  return { reservas, pedidos };
}

// ---------------------------------------------------------------------------
// catálogo público (sem login)

function todos(app: App, nome: string): Registro[] {
  const col = colecao(nome);
  return app.findRecordsByFilter(nome, 'excluido = false', '', 0, 0).map((r: RecordPB) => paraObjeto(col, r));
}

function dadosCatalogo(app: App): DadosCatalogo {
  return {
    especies: todos(app, 'especie'),
    nomesPopulares: todos(app, 'nome_popular'),
    viveiros: todos(app, 'viveiro'),
    lotesMudas: todos(app, 'lote_mudas'),
    movimentos: todos(app, 'movimento_estoque_mudas'),
    reservas: todos(app, 'reserva'),
    fotos: todos(app, 'especie_foto'),
  };
}

/** GET /api/crads/publico/catalogo */
export function catalogoPublico(app: App) {
  return { itens: montarCatalogo(dadosCatalogo(app)), gerado_em: new Date().toISOString() };
}

type Livre = { id: string; [k: string]: unknown };

function rastreioDe(app: App, lote: Livre, cache: Partial<Record<string, Livre[]>> = {}) {
  const pegar = (n: string) => (cache[n] ??= todos(app, n));
  return montarRastreio(lote, {
    viveiros: pegar('viveiro'),
    lotesSementes: pegar('lote_sementes'),
    ligacoes: pegar('lote_sementes_coleta'),
    coletas: pegar('coleta'),
    matrizes: pegar('matriz'),
    municipios: pegar('municipio'),
  });
}

/** GET /api/crads/publico/especie/{id} — ficha, fotos e lotes prontos com rastreio. */
export function especiePublica(app: App, id: string) {
  const d = dadosCatalogo(app);
  const e = d.especies.find((x) => x.id === id);
  if (!e || !e.publicada || e.ficticia) throw new Error('Espécie não encontrada no catálogo.');
  const disp = disponivelPorLote(d);
  const viveiros = new Map(d.viveiros.map((v) => [v.id, String(v.nome)]));
  const cache: Partial<Record<string, Livre[]>> = { viveiro: d.viveiros };
  const lotes = d.lotesMudas
    .filter((l) => l.especie_id === id && (disp.get(l.id) ?? 0) > 0)
    .map((l) => ({ disponivel: disp.get(l.id), viveiro: viveiros.get(String(l.viveiro_id)) ?? '', rastreio: rastreioDe(app, l, cache) }));
  return {
    ficha: fichaPublica(e),
    nomes_populares: d.nomesPopulares.filter((n) => n.especie_id === id).map((n) => String(n.nome)),
    fotos: d.fotos.filter((f) => f.especie_id === id && f.arquivo).map((f) => ({ id: f.id, parte: f.parte, arquivo: f.arquivo, miniatura: f.miniatura, credito: f.credito ?? '' })),
    lotes,
  };
}

/** GET /api/crads/publico/transparencia — totais e mapa dos plantios, sem dados pessoais. */
export function transparencia(app: App) {
  const t = (n: string) => todos(app, n);
  return {
    ...montarTransparencia({
      viveiros: [],
      especies: t('especie'),
      nomesPopulares: t('nome_popular'),
      matrizes: [],
      coletas: [],
      lotesSementes: [],
      ligacoes: [],
      movSementes: [],
      lotesMudas: [],
      eventosMudas: [],
      movMudas: [],
      doacoes: t('doacao'),
      doacaoItens: t('doacao_item'),
      doacaoItemLotes: [],
      historicoProgramas: t('doacao_programa_historico'),
      plantios: t('plantio'),
      plantioItens: t('plantio_item'),
      monitoramentos: t('monitoramento'),
      monitoramentoItens: t('monitoramento_item'),
    }),
    gerado_em: new Date().toISOString(),
  };
}

/** GET /api/crads/publico/rastreio/{codigo} — de onde vieram as mudas de um lote. */
export function rastreioPublico(app: App, codigo: string) {
  let rec: RecordPB;
  try {
    rec = app.findFirstRecordByFilter('lote_mudas', 'codigo = {:c} && excluido = false', { c: codigo.trim().toUpperCase() });
  } catch {
    throw new Error('Lote não encontrado.');
  }
  return rastreioDe(app, paraObjeto(colecao('lote_mudas'), rec));
}

// ---------------------------------------------------------------------------
// alterações feitas pelo superusuário no painel do PocketBase

const NOMES = new Set(COLECOES.map((c) => c.nome));

/** Antes de gravar pelo painel: sobe versão e seq (para chegar aos aparelhos). */
export function antesDeGravarPeloPainel(app: App, rec: RecordPB, criando: boolean) {
  const nome = rec.collection().name;
  if (!NOMES.has(nome)) return;
  if (criando && !rec.id) rec.set('id', novoId());
  rec.set('versao', (rec.getInt('versao') as number) + 1);
  rec.set('seq', proximoSeq(app));
}

export function auditarPainel(app: App, rec: RecordPB, acao: string, quem: string) {
  const nome = rec.collection().name;
  if (!NOMES.has(nome)) return;
  auditar(app, { colecao: nome, registro_id: rec.id, acao: `${acao}_painel`, antes: null, depois: paraObjeto(colecao(nome), rec), usuario_id: quem });
}

export const COLECOES_SINCRONIZADAS = COLECOES.map((c) => c.nome);
