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
  existeColecao,
  formatarCodigo,
  montarRecebimento,
  nomesCampos,
  podeEscrever,
  proximoCodigoLoteMudas,
  resolverOperacao,
  viveirosVisiveis,
  type Colecao,
  type ContextoUsuario,
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
  return { ...ctx, nome: auth.getString('name'), email: auth.getString('email') };
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
