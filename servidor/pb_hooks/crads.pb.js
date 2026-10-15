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

// Contas criadas pelo próprio celular e equipe do viveiro.
routerAdd("GET", "/api/crads/publico/viveiros", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.viveirosPublicos($app));
});

routerAdd("POST", "/api/crads/conta", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.criarConta($app, e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
});

routerAdd("GET", "/api/crads/equipe", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.equipe($app, e.auth));
  } catch (err) {
    throw new ForbiddenError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/equipe/pessoa", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.equipeCadastrar($app, e.auth, e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/equipe/pedido/{id}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.equipeResponder($app, e.auth, e.request.pathValue("id"), e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/equipe/vinculo/{id}/remover", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.equipeRemover($app, e.auth, e.request.pathValue("id")));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

// Lixeira e contas (só o administrador).
routerAdd("GET", "/api/crads/lixeira", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.lixeira($app, e.auth));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/lixeira/{colecao}/{id}/{acao}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  const acao = e.request.pathValue("acao");
  try {
    const col = e.request.pathValue("colecao");
    const id = e.request.pathValue("id");
    if (acao === "restaurar") return e.json(200, crads.lixeiraRestaurar($app, e.auth, col, id));
    if (acao === "apagar") return e.json(200, crads.lixeiraApagar($app, e.auth, col, id));
    throw new Error("Ação desconhecida.");
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/equipe/usuario/{id}/apagar", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.apagarConta($app, e.auth, e.request.pathValue("id")));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

// Baixar foto/arquivo de um registro que a pessoa pode ler.
routerAdd("GET", "/api/crads/arquivo/{colecao}/{id}/{campo}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  let alvo;
  try {
    alvo = crads.arquivoParaLer($app, e.auth, e.request.pathValue("colecao"), e.request.pathValue("id"), e.request.pathValue("campo"));
  } catch (err) {
    throw new NotFoundError(String(err).replace(/^Error: /, ""));
  }
  const fsys = $app.newFilesystem();
  try {
    fsys.serve(e.response, e.request, alvo.chave, alvo.nome);
  } finally {
    fsys.close();
  }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/crads/doacao/{id}/contato", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.contatoDoacao($app, e.auth, e.request.pathValue("id")));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/crads/publico/foto/{id}/{arquivo}", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  let alvo;
  try {
    alvo = crads.fotoMudaPublica($app, e.request.pathValue("id"), e.request.pathValue("arquivo"));
  } catch (err) {
    throw new NotFoundError(String(err).replace(/^Error: /, ""));
  }
  const fsys = $app.newFilesystem();
  try {
    fsys.serve(e.response, e.request, alvo.chave, alvo.nome);
  } finally {
    fsys.close();
  }
});

// Avisos no celular com o app fechado (Web Push): inscrição do aparelho.
routerAdd("POST", "/api/crads/push/inscrever", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    return e.json(200, crads.inscreverPush($app, e.auth, e.requestInfo().body));
  } catch (err) {
    throw new BadRequestError(String(err).replace(/^Error: /, ""));
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/push/sair", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  return e.json(200, crads.sairPush($app, e.auth, e.requestInfo().body));
}, $apis.requireAuth("users"));

// Pedido novo, aprovação, retirada combinada, pedido de acesso: avisa quem precisa saber.
onRecordAfterCreateSuccess((e) => {
  e.next();
  require(`${__hooks}/lib/crads.js`).avisarPush($app, e.record.collection().name, null, e.record);
}, "doacao", "pedido_acesso");

onRecordAfterUpdateSuccess((e) => {
  e.next();
  require(`${__hooks}/lib/crads.js`).avisarPush($app, e.record.collection().name, e.record.original(), e.record);
}, "doacao", "pedido_acesso");

// Lote de sementes automático: cada coleta vira um lote (rastreável até a matriz), sem ninguém precisar formar.
onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    require(`${__hooks}/lib/crads.js`).loteAutomatico($app, e.record.id);
  } catch (err) {
    console.log("lote automático: " + String(err));
  }
}, "coleta");

// Matriz identificada depois: as coletas dela que ainda não tinham lote ganham o lote agora.
onRecordAfterUpdateSuccess((e) => {
  e.next();
  if (!e.record.getString("especie_id")) return;
  require(`${__hooks}/lib/crads.js`).lotesAutomaticosPendentes($app, `excluido = false && matriz_id = '${e.record.id}'`);
}, "matriz");

// Coletas que ficaram sem lote (antigas, ou de matriz identificada depois): confere a cada 15 minutos.
cronAdd("crads_lotes_pendentes", "*/15 * * * *", () => {
  try {
    const n = require(`${__hooks}/lib/crads.js`).lotesAutomaticosPendentes($app);
    if (n) console.log(`lotes automáticos criados para ${n} coleta(s)`);
  } catch (err) {
    console.log("lotes automáticos pendentes: " + String(err));
  }
});

// Lista oficial de espécies (Flora e Funga do Brasil): situação e pedido para baixar agora.
routerAdd("GET", "/api/crads/flora/situacao", (e) => {
  const arquivo = `${__hooks}/../pb_public/flora/situacao.json`;
  try {
    return e.json(200, JSON.parse(toString($os.readFile(arquivo))));
  } catch (_) {
    return e.json(200, { ok: false, erro: "A lista ainda não foi baixada neste servidor." });
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/crads/flora/atualizar", (e) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  try {
    crads.exigirPermissaoEspecies($app, e.auth);
  } catch (err) {
    throw new ForbiddenError(String(err).replace(/^Error: /, ""));
  }
  const script = `${__hooks}/../deploy/flora.py`;
  const destino = `${__hooks}/../pb_public/flora/flora-TO.zip.novo`;
  $os.mkdirAll(`${__hooks}/../pb_public/flora`, 493 /* 0755 */);
  // Roda em segundo plano (pode levar alguns minutos); o app acompanha pela situação.
  $os.cmd("sh", "-c", 'nohup python3 "$0" "$1" TO >/dev/null 2>&1 &', script, destino).run();
  return e.json(202, { ok: true, andamento: "baixando a lista do Jardim Botânico (pode levar alguns minutos)" });
}, $apis.requireAuth("users"));
