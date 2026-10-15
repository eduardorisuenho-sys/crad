import { expect, test } from '@playwright/test';
import { entrarComoColetor, entrarComoViveirista, lerDoServidor } from './apoio';

test.use({ permissions: ['geolocation'], geolocation: { latitude: -10.1905, longitude: -48.3405, accuracy: 8 } });

test('coletor registra coleta sem internet; a coleta vira lote sozinha; viveirista pesa, guarda no endereço e controla o saldo', async ({ browser }) => {
  // ---- coletor, em campo
  const ctxColetor = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -10.1905, longitude: -48.3405, accuracy: 8 } });
  const coletor = await ctxColetor.newPage();
  await entrarComoColetor(coletor);
  await expect(coletor.getByTestId('barra-sync')).toContainText('Tudo enviado');
  // logomarca acima do "Olá": símbolo carregado e o nome CRAD
  const marca = coletor.getByTestId('marca-inicio');
  await expect(marca).toContainText('CRAD');
  await expect(marca).toContainText('Centro de Recuperação de Áreas Degradadas');
  expect(await marca.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThanOrEqual(480);
  const alturaMarca = (await marca.boundingBox())!.y;
  expect(alturaMarca).toBeLessThan((await coletor.getByRole('heading', { name: 'Olá, Coletor' }).boundingBox())!.y);
  if (process.env.CRADS_FOTO_INICIO) { await coletor.evaluate(() => window.scrollTo(0, 0)); await coletor.screenshot({ path: process.env.CRADS_FOTO_INICIO, clip: { x: 0, y: 0, width: 400, height: 520 } }); }
  await ctxColetor.setOffline(true);
  await coletor.getByRole('link', { name: 'Coleta e sementes' }).click();

  // rota: a matriz aprovada aparece com fruto maduro e distância
  await coletor.getByRole('link', { name: 'Rota de coleta' }).click();
  const item = coletor.locator('.item-lista', { hasText: 'MT-9001' });
  await expect(item).toContainText('fruto maduro');
  await expect(item).toContainText(/\d+ m/);
  // fundo híbrido (satélite + nomes e estradas), com crédito, e o caminho pelo Google Maps
  const fundo = coletor.getByTestId('fundo-hibrido');
  await expect(fundo.locator('image').first()).toHaveAttribute('href', /World_Imagery\/MapServer\/tile\/\d+\/\d+\/\d+$/);
  await expect(coletor.getByText('Imagens: Esri, Maxar, Earthstar Geographics')).toBeVisible();
  // escolhe a matriz: o mapa mostra só ela e você, com a linha até a árvore
  await expect(coletor.locator('svg.mapa-rota circle[r="6"], svg.mapa-rota circle[r="9"]')).toHaveCount(2);
  await item.click();
  const rota = coletor.getByTestId('rota-escolhida');
  await expect(rota).toContainText('Até MT-9001');
  await expect(rota).toContainText(/\d+ m em linha reta, para o (norte|nordeste|leste|sudeste|sul|sudoeste|oeste|noroeste)/);
  await expect(coletor.getByTestId('linha-rota')).toBeVisible();
  await expect(coletor.locator('svg.mapa-rota circle[r="6"], svg.mapa-rota circle[r="9"]')).toHaveCount(1);
  await expect(coletor.locator('.item-lista', { hasText: 'MT-9002' })).toHaveCount(0);
  await expect(rota.getByRole('link', { name: /Caminho pelas estradas/ })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d/);
  if (process.env.CRADS_FOTO_ROTA) await coletor.screenshot({ path: process.env.CRADS_FOTO_ROTA, fullPage: true });
  await coletor.getByRole('button', { name: 'Satélite' }).click();
  await expect(fundo).toHaveCount(0);
  // o voltar do celular volta para a lista de todas
  await coletor.goBack();
  await expect(coletor.locator('.item-lista', { hasText: 'MT-9002' })).toBeVisible();
  await item.click();
  await rota.getByRole('button', { name: 'Ver todas as matrizes' }).click();
  await expect(coletor.locator('.item-lista', { hasText: 'MT-9002' })).toBeVisible();
  await coletor.getByRole('button', { name: 'Voltar' }).click();

  await coletor.getByRole('link', { name: 'Registrar coleta' }).click();
  await coletor.getByRole('button', { name: /MT-9001/ }).click();
  await coletor.getByLabel('Quantidade').fill('2,5');
  await coletor.getByRole('button', { name: 'Quilos (kg)' }).click();
  await coletor.getByRole('button', { name: 'Continuar' }).click();
  await coletor.getByRole('button', { name: 'Frutos' }).click();
  await coletor.getByRole('button', { name: 'Pular a foto' }).click();
  await expect(coletor.locator('.ficha')).toContainText('2,5 quilos (kg) de frutos');
  await coletor.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(coletor.getByText('Coleta salva')).toBeVisible();
  await expect(coletor.locator('.item-lista', { hasText: 'MT-9001' })).toContainText('não enviado');

  await ctxColetor.setOffline(false);
  await expect(coletor.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  const [coleta] = (await lerDoServidor('coleta')).filter((c) => c.quantidade === 2.5);
  expect(coleta).toMatchObject({ unidade: 'kg', material: 'fruto', lat: -10.1905 });
  await ctxColetor.close();

  // ---- viveirista, no viveiro
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrarComoViveirista(page);
  // a coleta virou um lote de sementes sozinha no servidor e chega ao aparelho
  const lotesDaColeta = async () => (await lerDoServidor('lote_sementes_coleta')).filter((l) => l.coleta_id === coleta.id);
  await expect.poll(async () => (await lotesDaColeta()).length, { timeout: 20_000 }).toBe(1);
  const loteId = String((await lotesDaColeta())[0].lote_sementes_id);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await ctx.setOffline(true);
  await page.getByRole('link', { name: 'Coleta e sementes' }).click();

  // sem botões de Lotes de sementes e Armazenamento: a coleta abre o seu lote
  await expect(page.getByRole('link', { name: 'Lotes de sementes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Armazenamento' })).toHaveCount(0);
  await page.locator('a.item-lista', { hasText: 'MT-9001' }).filter({ hasText: '2,5 kg' }).click();
  await expect(page).toHaveURL(new RegExp(`/coleta/lotes/${loteId}$`));

  // o lote automático (de frutos) pede o peso das sementes limpas
  await expect(page.getByTestId('pesar-sementes')).toContainText('frutos: 2,5 kg');
  await page.getByTestId('pesar-sementes').getByLabel('Peso das sementes limpas (gramas)').fill('800');
  await page.getByRole('button', { name: 'Salvar peso' }).click();
  await expect(page.getByTestId('saldo')).toHaveText('800 g');
  await expect(page.getByTestId('pesar-sementes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mudar de lugar' })).toHaveCount(0);
  await expect(page.getByTestId('etiqueta')).toContainText('1 matriz(es)');

  // teste de germinação tira do saldo; descarte maior que o saldo é bloqueado
  await page.getByRole('button', { name: 'Teste de germinação' }).click();
  await page.getByLabel('Gramas').fill('20');
  await page.getByLabel('Resultado do teste: % que germinou (opcional)').fill('85');
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(page.getByTestId('saldo')).toHaveText('780 g');
  await page.getByRole('button', { name: 'Descarte' }).click();
  await page.getByLabel('Gramas').fill('1000');
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(page.getByText('Só há 780 g neste lote.')).toBeVisible();

  // rastreio: o lote volta à matriz de origem
  await expect(page.locator('.cartao', { hasText: 'Origem das sementes' })).toContainText('MT-9001');

  await ctx.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const lote = (await lerDoServidor('lote_sementes')).find((l) => l.id === loteId)!;
  expect(lote).toMatchObject({ peso_g: 800, germinacao_teste_pct: 85, origem: 'coleta' });
  expect(String(lote.codigo)).toMatch(/^LS-\d{4}-\d{3}$/);
  const movs = (await lerDoServidor('movimento_sementes')).filter((m) => m.lote_sementes_id === lote.id);
  expect(movs.map((m) => m.tipo).sort()).toEqual(['ajuste', 'entrada', 'teste']);
  await ctx.close();
});
