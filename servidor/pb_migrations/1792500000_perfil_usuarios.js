/// Coluna "perfil" na tabela de usuários (painel do servidor): quem é coletor, viveirista,
/// gestor, solicitante ou administrador. Preenchida pelo servidor (pb_hooks), logo depois do nome.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const pos = users.fields.fieldNames().indexOf("name") + 1;
  users.fields.addAt(pos, new TextField({ name: "perfil", max: 500 }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("perfil");
  app.save(users);
});
