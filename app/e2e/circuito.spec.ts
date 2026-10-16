/**
 * Circuito completo, do começo ao fim, com espécies novas (como as que a
 * gestão cadastra ou importa da lista oficial, sem "publicar"):
 * espécie → coleta sem matriz → lote de sementes automático → semeadura →
 * germinação → em formação (fora do catálogo, com o motivo) → pronta →
 * catálogo → pedido (limite por espécie) → recusa e aprovação em parte →
 * avisos → retirada a menos → baixa e sobra de volta ao catálogo → rastreio.
 */
import { expect, test, type Page } from '@playwright/test';
import { entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor, noCatalogo, PB } from './apoio';

test.use({ actionTimeout: 20_000 });

const NOVA = 'Árvore-do-circuito';
const IMPORTADA = 'Árvore-importada-do-circuito';

async function pedir(s: Page, itens: [string, number][], finalidade = 'Escola ou quintal') {
  await s.goto('/doacao/novo');
  for (const [nome, q] of itens) await s.getByLabel(`Quantidade de ${nome}`).fill(String(q));
  await s.getByRole('button', { name: /Continuar/ }).click();
  await s.getByRole('button', { name: finalidade }).click();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByLabel('CPF').fill('000.000.000-00');
  await s.getByLabel('Telefone').fill('63 90000-0009');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(s.getByText('Pedido registrado')).toBeVisible();
  await expect.poll(async () => (await s.getByRole('heading', { level: 1 }).innerText()).trim(), { timeout: 20_000 }).toMatch(/^Pedido DO-\d{4}-\d{3}$/);
  return (await s.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
}

async function assinar(p: Page) {
  const tela = p.getByLabel('Área para assinar');
  const caixa = (await tela.boundingBox())!;
  const toque = (tipo: string, x: number, y: number) => tela.dispatchEvent(tipo, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: caixa.x + x, clientY: caixa.y + y });
  await toque('pointerdown', 20, 100);
  for (const [x, y] of [[80, 60], [160, 110], [220, 70]]) await toque('pointermove', x, y);
  await toque('pointerup', 220, 70);
}

test('circuito completo: da semente ao plantio, com casos simples e difíceis', async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };

  // ---- 1. gestora cadastra uma espécie nova (não publicada) e outra vem "da lista oficial"
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.goto('/especies/nova');
  const nomes = g.getByTestId('nomes-populares');
  await nomes.getByLabel('Novo nome popular').fill(NOVA);
  await nomes.getByRole('button', { name: 'Incluir' }).click();
  await g.getByLabel('Nome científico').fill('Circuitia completa');
  await g.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect(g).toHaveURL(/\/especies\/[a-z0-9]{10,}/);
  const imp = (await (await fetch(`${PB()}/api/collections/especie/records`, { method: 'POST', headers: admin, body: JSON.stringify({ nome_cientifico: 'Importia oficialis', familia: 'Testaceae', fonte_cadastro: 'flora_funga', publicada: false }) })).json()) as { id: string };
  await fetch(`${PB()}/api/collections/nome_popular/records`, { method: 'POST', headers: admin, body: JSON.stringify({ especie_id: imp.id, nome: IMPORTADA, nome_busca: 'arvore importada do circuito' }) });
  await expect.poll(async () => (await lerDoServidor('especie')).find((e) => e.nome_cientifico === 'Circuitia completa')?.publicada, { timeout: 20_000 }).toBe(false);

  // ---- 2. viveirista: coleta sem matriz (botão Coleta) de 300 g de sementes, sem internet
  const cv = await browser.newContext();
  const v = await cv.newPage();
  await entrarComoViveirista(v);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await cv.setOffline(true);
  await v.goto('/coleta/nova');
  await v.getByRole('button', { name: /^Coleta/ }).click();
  await v.getByLabel('Nome da espécie').fill('circuito');
  await v.getByRole('button', { name: new RegExp(NOVA) }).click();
  await v.getByLabel('Quantidade').fill('300');
  await v.getByRole('button', { name: 'Gramas (g)' }).click();
  await v.getByRole('button', { name: 'Continuar' }).click();
  await v.getByRole('button', { name: 'Sementes' }).click();
  await v.getByRole('button', { name: 'Pular a foto' }).click();
  await v.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(v.getByText('Coleta salva')).toBeVisible();
  await cv.setOffline(false);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  // a coleta vira lote de sementes sozinha no servidor (sem formar, sem aprovar)
  const especieNova = (await lerDoServidor('especie')).find((e) => e.nome_cientifico === 'Circuitia completa')!;
  await expect.poll(async () => (await lerDoServidor('lote_sementes')).filter((l) => l.especie_id === especieNova.id).length, { timeout: 30_000 }).toBe(1);

  // ---- 3. semeadura pela espécie, sem internet: 100 g, 400 sementes
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await v.reload();
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await cv.setOffline(true);
  await v.goto('/viveiro/semeadura');
  await v.getByLabel('Buscar semente').fill('circuito');
  await v.locator('.item-lista', { hasText: NOVA }).click();
  await v.getByLabel('Número de sementes').fill('400');
  await v.getByLabel('Peso (gramas)').fill('100');
  await v.getByRole('button', { name: 'Continuar' }).click();
  await v.getByRole('button', { name: 'Tubete' }).click();
  await v.getByRole('button', { name: 'Continuar' }).click();
  await v.getByRole('button', { name: 'Criar lote de mudas' }).click();
  await expect(v.getByTestId('etiqueta-lm')).toContainText(NOVA);
  const registrar = (acao: string) => v.getByRole('button', { name: acao, exact: true }).click();
  await registrar('Contar germinação');
  await v.getByLabel('Total de plântulas nascidas até hoje').fill('90');
  await registrar('Registrar');
  await expect(v.getByTestId('saldo-mudas')).toHaveText('90');
  await expect(v.getByTestId('resumo-lm')).toContainText('Em formação');
  const urlLote = v.url().replace(/\?.*$/, '');
  await cv.setOffline(false);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });

  // ---- 4. em formação: não aparece no catálogo, e o catálogo diz por quê
  expect(await noCatalogo(NOVA)).toBe(0);
  await v.goto('/catalogo');
  const diag = v.getByTestId('diagnostico-catalogo');
  await expect(diag.locator('.item-lista', { hasText: NOVA })).toContainText('Em formação: abra o lote e toque em “Ficou pronta para doação”.');
  await diag.locator('.item-lista', { hasText: NOVA }).click();
  await expect(v).toHaveURL(urlLote);
  await registrar('Marcar como pronta');
  await registrar('Registrar');
  await expect(v.getByTestId('resumo-lm')).toContainText('Pronta para doação');
  // perda depois de pronta: 90 → 85
  await registrar('Perda');
  await v.getByLabel('Quantas mudas morreram ou foram descartadas').fill('5');
  await registrar('Registrar');
  await expect(v.getByTestId('saldo-mudas')).toHaveText('85');
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(() => noCatalogo(NOVA), { timeout: 20_000 }).toBe(85);
  await v.goto('/catalogo');
  await expect(v.locator('.cartao-especie', { hasText: NOVA })).toContainText('85 mudas');
  await expect(v.locator('.item-lista', { hasText: NOVA })).toHaveCount(0); // já não está no diagnóstico

  // ---- 5. espécie "da lista oficial": 40 mudas registradas pela gestora aparecem sem liberar nada
  await g.goto('/viveiro/estoque-inicial');
  await g.getByRole('button', { name: /Uma espécie por vez/ }).click();
  await g.getByLabel('Nome da espécie').fill('importada do circuito');
  await g.getByRole('button', { name: new RegExp(IMPORTADA) }).click();
  await g.getByLabel('Quantas mudas?').fill('40');
  await g.getByRole('button', { name: 'Salvar' }).click();
  await expect(g.getByTestId('estoque-ok')).toContainText('40 mudas');
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(() => noCatalogo(IMPORTADA), { timeout: 20_000 }).toBe(40);

  // ---- 6. solicitante: limite de 30 por espécie, pedido com duas espécies (total 50, sem limite no total)
  const cs = await browser.newContext({ acceptDownloads: true });
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await s.goto('/doacao/novo');
  await s.getByLabel(`Quantidade de ${NOVA}`).fill('31');
  await s.getByRole('button', { name: /Continuar/ }).click();
  await expect(s.getByText(`Cada pedido pode ter até 30 mudas de ${NOVA}.`)).toBeVisible();
  const pedidoA = await pedir(s, [[NOVA, 30], [IMPORTADA, 20]]);
  // e um segundo pedido, que vai ser recusado
  const pedidoB = await pedir(s, [[IMPORTADA, 5]], 'Beira de rio ou nascente');
  await expect.poll(async () => (await lerDoServidor('doacao')).filter((d) => [pedidoA, pedidoB].includes(String(d.codigo))).length, { timeout: 20_000 }).toBe(2);

  // ---- 7. gestora: recusa sem motivo é bloqueada; recusa com motivo; aprova o outro em parte
  await g.goto('/doacao');
  await expect(g.getByTestId('notificacoes')).toContainText('Novo pedido de mudas', { timeout: 20_000 });
  await g.locator('.item-lista', { hasText: pedidoB }).click();
  await g.getByRole('button', { name: 'Analisar pedido' }).click();
  await g.getByRole('button', { name: 'Recusar' }).click();
  await expect(g.locator('.erro')).toBeVisible();
  await g.getByLabel('Observação (obrigatória para recusar)').fill('Local de plantio fora da área do programa.');
  await g.getByRole('button', { name: 'Recusar' }).click();
  await expect(g.getByText('Pedido recusado.')).toBeVisible();
  await g.goto('/doacao');
  await g.locator('.item-lista', { hasText: pedidoA }).click();
  await g.getByRole('button', { name: 'Analisar pedido' }).click();
  await g.getByLabel(`Aprovar de ${NOVA}`).fill('25');
  await g.getByLabel(`Aprovar de ${IMPORTADA}`).fill('20');
  await g.getByRole('button', { name: 'Aprovar e reservar' }).click();
  await expect(g.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  // reservadas saem do catálogo na hora
  await expect.poll(() => noCatalogo(NOVA), { timeout: 20_000 }).toBe(60);
  await expect.poll(() => noCatalogo(IMPORTADA), { timeout: 20_000 }).toBe(20);

  // ---- 8. solicitante: avisos de recusa (com motivo) e de aprovação, e o contato do viveiro
  await s.goto('/doacao');
  // dois avisos: aparece um por vez (o mais novo) para não cobrir a tela; os outros em "Ver mais"
  const avisos = s.getByTestId('notificacoes');
  await expect(avisos.getByRole('button', { name: 'Ver mais 1 aviso' })).toBeVisible({ timeout: 20_000 });
  await expect(avisos.locator('.notificacao')).toHaveCount(1);
  await avisos.getByRole('button', { name: 'Ver mais 1 aviso' }).click();
  await expect(avisos).toContainText('Seu pedido de mudas foi aprovado!');
  await expect(avisos).toContainText('Seu pedido de mudas não foi aprovado');
  await avisos.getByRole('button', { name: 'Fechar todos' }).click();
  await expect(avisos).toHaveCount(0);
  await s.locator('.item-lista', { hasText: pedidoB }).click();
  await expect(s.getByText('Local de plantio fora da área do programa.')).toBeVisible();
  await s.goto('/doacao');
  await s.locator('.item-lista', { hasText: pedidoA }).click();
  await expect(s.getByTestId('resumo-pedido')).toContainText('aprovado em parte');
  await expect(s.getByTestId('combinar-retirada')).toBeVisible();
  // quem pediu não vê a ação de dar baixa
  await expect(s.getByRole('link', { name: 'As mudas saíram (dar baixa)' })).toHaveCount(0);
  // fichas das espécies do pedido em PDF
  const [fichas] = await Promise.all([s.waitForEvent('download', { timeout: 30_000 }), s.getByRole('button', { name: 'Fichas das espécies com fotos (PDF)' }).click()]);
  expect(fichas.suggestedFilename()).toBe(`especies-${pedidoA}.pdf`);

  // ---- 9. viveirista: entrega a menos (20 de 25 e 20 de 20), sem internet; a sobra volta ao catálogo
  // abre o app com sinal (recebe a aprovação) e vai para o balcão sem internet
  await v.goto('/doacao');
  await v.getByRole('button', { name: 'Aguardando retirada' }).click();
  await expect(v.locator('.item-lista', { hasText: pedidoA })).toBeVisible({ timeout: 70_000 });
  await cv.setOffline(true);
  await v.locator('.item-lista', { hasText: pedidoA }).click();
  await v.getByRole('link', { name: 'As mudas saíram (dar baixa)' }).click();
  await v.getByLabel(`Entregues de ${NOVA}`).fill('26');
  await v.getByLabel(`Entregues de ${IMPORTADA}`).fill('20');
  await v.getByLabel('Nome').fill('Recebedor do Circuito');
  await assinar(v);
  await v.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(v.getByText(/reservadas 25 mudas.*não dá para entregar 26/)).toBeVisible();
  await v.getByLabel(`Entregues de ${NOVA}`).fill('20');
  await v.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(v.getByTestId('resumo-pedido')).toContainText('retirado');
  // retirada já feita: não dá para dar baixa de novo
  await expect(v.getByRole('link', { name: 'As mudas saíram (dar baixa)' })).toHaveCount(0);
  await cv.setOffline(false);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  // 85 − 20 entregues = 65 (as 5 reservadas e não levadas voltam); 40 − 20 = 20
  await expect.poll(() => noCatalogo(NOVA), { timeout: 20_000 }).toBe(65);
  await expect.poll(() => noCatalogo(IMPORTADA), { timeout: 20_000 }).toBe(20);
  const doacaoA = (await lerDoServidor('doacao')).find((d) => d.codigo === pedidoA)!;
  expect(doacaoA.situacao).toBe('retirada');
  const saidas = (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.referencia === pedidoA);
  expect(saidas.map((m) => m.quantidade).sort()).toEqual([20, 20]);
  const reservas = (await lerDoServidor('reserva')).filter((r) => saidas.some((m) => m.lote_mudas_id === r.lote_mudas_id));
  expect(reservas.every((r) => r.situacao !== 'ativa')).toBe(true);

  // ---- 10. rastreio público do lote semeado: volta até a coleta (árvore sem matriz), sem dados pessoais
  const lm = (await lerDoServidor('lote_mudas')).find((l) => l.especie_id === especieNova.id)!;
  const r = await (await fetch(`${PB()}/api/crads/publico/rastreio/${String(lm.codigo)}`)).json();
  expect(r.lote_sementes).toMatchObject({ arvores_sem_matriz: 1 });
  expect(JSON.stringify(r)).not.toMatch(/000\.000|90000|Recebedor/);
  // transparência conta as mudas doadas
  const t = await (await fetch(`${PB()}/api/crads/publico/transparencia`)).json();
  expect(t.mudas_doadas).toBeGreaterThanOrEqual(40);

  // ---- 11. o plantio: quem pediu registra o pós-plantio deste pedido
  await s.goto('/doacao');
  await s.locator('.item-lista', { hasText: pedidoA }).click();
  await expect(s.getByTestId('resumo-pedido')).toContainText('retirado', { timeout: 20_000 });
  await expect(s.getByRole('link', { name: 'Pós-plantio' })).toBeVisible();

  await cs.close();
  await cv.close();
  await cg.close();
});
