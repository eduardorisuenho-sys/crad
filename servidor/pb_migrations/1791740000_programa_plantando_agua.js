/// Cadastra o programa Plantando Água (as doações recebem uma marcação dele).
migrate((app) => {
  // próximo número de sincronização (para o registro chegar aos aparelhos)
  let contador;
  try {
    contador = app.findRecordById("sync_contador", "contadorglobal1");
  } catch (_) {
    contador = new Record(app.findCollectionByNameOrId("sync_contador"));
    contador.set("id", "contadorglobal1");
    contador.set("valor", 0);
  }
  const seq = contador.getInt("valor") + 1;
  contador.set("valor", seq);
  app.save(contador);

  const p = new Record(app.findCollectionByNameOrId("programa"));
  p.set("id", "plantandoagua01");
  p.set("nome", "Plantando Água");
  p.set("icone", "agua");
  p.set("cor", "#259ad4");
  p.set("ativo", true);
  p.set("versao", 1);
  p.set("seq", seq);
  p.set("excluido", false);
  app.save(p);
}, (app) => {
  try {
    app.delete(app.findRecordById("programa", "plantandoagua01"));
  } catch (_) {}
});
