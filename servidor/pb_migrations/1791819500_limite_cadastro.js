/// Freio contra robôs no auto-cadastro: no máximo 10 contas por hora por endereço de internet.
migrate((app) => {
  const s = app.settings();
  // Só esta regra: as regras padrão (login, /api/) ficam desligadas como antes,
  // para não frear a sincronização de vários aparelhos atrás do mesmo roteador.
  s.rateLimits.rules = [{ label: "POST /api/crads/conta", maxRequests: 10, duration: 3600, audience: "" }];
  s.rateLimits.enabled = true;
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.rules = (s.rateLimits.rules || []).filter((r) => r.label !== "POST /api/crads/conta");
  app.save(s);
});
