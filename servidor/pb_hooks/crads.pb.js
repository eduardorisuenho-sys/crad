/// <reference path="../pb_data/types.d.ts" />
// Rotas do CRADS. A lógica fica em lib/crads.js (gerado a partir de src/crads.ts).
// Cada handler roda isolado no PocketBase, por isso o require fica dentro dele.

routerAdd("GET", "/api/crads/saude", (e) => e.json(200, { ok: true }));

routerAdd("GET", "/api/crads/eu", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.eu($app, e.auth));
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/sync/enviar", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.enviar($app, e.auth, e.requestInfo().body));
}, $apis.requireAuth("users"), $apis.bodyLimit(20 << 20));

routerAdd("GET", "/api/crads/sync/receber", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  const q = e.requestInfo().query;
  return e.json(200, crads.receber($app, e.auth, Number(q.desde) || 0, Number(q.limite) || 500, q.dispositivo || ""));
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/sync/faixas", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.reservarFaixas($app, e.auth, e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/arquivo/{colecao}/{id}/{campo}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  const campo = e.request.pathValue("campo");
  let arquivos = [];
  try {
    arquivos = e.findUploadedFiles(campo);
  } catch (_) {}
  try {
    return e.json(200, crads.receberArquivo($app, e.auth, e.request.pathValue("colecao"), e.request.pathValue("id"), campo, arquivos, e.requestInfo().query.dispositivo || ""));
  } catch (err) {
    throw new BadRequestError(String(err));
  }
}, $apis.requireAuth("users"), $apis.bodyLimit(16 << 20));

// Alterações feitas pelo superusuário no painel: sobem versão/seq (para chegar
// aos aparelhos) e ficam na auditoria. Apagar de verdade é proibido.
onRecordCreateRequest((e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  crads.antesDeGravarPeloPainel($app, e.record, true);
  e.next();
  crads.auditarPainel($app, e.record, "criar", e.auth ? e.auth.email() : "painel");
});

onRecordUpdateRequest((e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  crads.antesDeGravarPeloPainel($app, e.record, false);
  e.next();
  crads.auditarPainel($app, e.record, "alterar", e.auth ? e.auth.email() : "painel");
});

onRecordDeleteRequest((e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  if (crads.COLECOES_SINCRONIZADAS.indexOf(e.record.collection().name) >= 0) {
    throw new BadRequestError("Não apague registros: marque o campo 'excluido'. Assim a exclusão chega aos aparelhos e fica na auditoria.");
  }
  e.next();
});

// Catálogo público: sem login, só dados públicos (sem coordenadas nem dados pessoais).
routerAdd("GET", "/api/crads/publico/catalogo", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.catalogoPublico($app));
});

routerAdd("GET", "/api/crads/publico/transparencia", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.transparencia($app));
});

routerAdd("GET", "/api/crads/publico/especie/{id}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.especiePublica($app, e.request.pathValue("id")));
  } catch (err) {
    throw new NotFoundError(String(err).replace(/^Error: /, ""));
  }
});

routerAdd("GET", "/api/crads/publico/rastreio/{codigo}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.rastreioPublico($app, e.request.pathValue("codigo")));
  } catch (err) {
    throw new NotFoundError(String(err).replace(/^Error: /, ""));
  }
});

// Doação: análise com reservas (precisa de internet) e expiração dos prazos.
routerAdd("POST", "/api/crads/doacao/{id}/analisar", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.analisarDoacao($app, e.auth, e.request.pathValue("id"), e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

cronAdd("crads_expirar_prazos", "17 3 * * *", () => {
  const crads = require(`${__hooks}/lib/crads.js`);
  crads.expirarPrazos($app);
});

// Para testes e manutenção: só o superusuário.
routerAdd("POST", "/api/crads/manutencao/expirar", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  const hoje = e.requestInfo().body.hoje;
  return e.json(200, crads.expirarPrazos($app, hoje || undefined));
}, $apis.requireSuperuserAuth());
