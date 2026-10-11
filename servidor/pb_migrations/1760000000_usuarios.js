/// Campos do CRADS na coleção de usuários do PocketBase ("users").
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "gestor_geral" }));
  users.fields.add(new BoolField({ name: "solicitante" }));
  // Usuários só leem/alteram o próprio cadastro; criação e perfis ficam com o gestor.
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = null;
  users.updateRule = null;
  users.deleteRule = null;
  // O coletor pode passar semanas sem internet: a sessão vale 30 dias.
  users.authToken.duration = 30 * 24 * 60 * 60;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("gestor_geral");
  users.fields.removeByName("solicitante");
  app.save(users);
});
