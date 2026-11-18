/// Manual do viveirista: cadastra uma vez os manuais que vêm com o servidor (PDF em deploy/manuais).
/// Numa migração, roda uma única vez; se o gestor excluir, não volta.
migrate((app) => {
  const crads = require(`${__hooks}/lib/crads.js`);
  const pasta = `${__hooks}/../deploy/manuais`;
  const n = crads.semearManuais(app, pasta, (caminho) => $filesystem.fileFromPath(caminho));
  if (n) console.log(`manuais do viveirista cadastrados: ${n}`);
}, () => {});
