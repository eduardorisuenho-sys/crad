import { expect, test } from '@playwright/test';
import { entrarComoColetor, entrarComoViveirista, lerDoServidor } from './apoio';

test.use({ permissions: ['geolocation'], geolocation: { latitude: -10.1905, longitude: -48.3405, accuracy: 8 } });

test('coletor registra coleta sem internet; viveirista forma o lote, guarda no endereço e controla o saldo', async ({ browser }) => {
  // ---- coletor, em campo
  const ctxColetor = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -10.1905, longitude: -48.3405, accuracy: 8 } });
  const coletor = await ctxColetor.newPage();
  await entrarComoColetor(coletor);
  await expect(coletor.getByTestId('barra-sync')).toContainText('Tudo enviado');
  await ctxColetor.setOffline(true);
  await coletor.getByRole('link', { name: 'Coleta e sementes' }).click();

  // rota: a matriz aprovada aparece com fruto maduro e distância
  await coletor.getByRole('link', { name: 'Rota de coleta' }).click();
  const item = coletor.locator('.item-lista', { hasText: 'MT-9001' });
  await expect(item).toContainText('fruto maduro');
  await expect(item).toContainText(/\d+ m/);
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
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await ctx.setOffline(true);
  await page.getByRole('link', { name: 'Coleta e sementes' }).click();

  // endereço do armazenamento
  await page.getByRole('link', { name: 'Armazenamento' }).click();
  await page.getByRole('button', { name: 'Novo endereço' }).click();
  await page.getByLabel('Local (ex.: Câmara fria 1, Sala seca)').fill('Câmara fria 1');
  await page.getByLabel('Estante').fill('2');
  await expect(page.getByTestId('codigo-endereco')).toHaveText('TST-CAMARAFRIA1-E2');
  await page.getByRole('button', { name: 'Salvar endereço' }).click();
  await page.getByRole('button', { name: 'Voltar' }).click();

  // formar o lote: só uma matriz → alerta de diversidade, mas pode criar
  await page.getByRole('link', { name: 'Lotes de sementes' }).click();
  await page.getByRole('link', { name: 'Formar lote' }).click();
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await expect(page.getByText(/1 matriz\(es\).*pelo menos 12/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar (1 matrizes)' }).click();
  await expect(page.getByText('Coletado: 2500 g')).toBeVisible();
  await page.getByLabel('Peso das sementes limpas (gramas)').fill('800');
  await page.getByLabel('Onde vai ficar guardado').selectOption({ label: 'TST-CAMARAFRIA1-E2' });
  await page.getByRole('button', { name: 'Criar lote' }).click();
  await expect(page.getByTestId('etiqueta')).toContainText('1 matriz(es)');
  await expect(page.getByTestId('etiqueta')).toContainText('TST-CAMARAFRIA1-E2');
  await expect(page.getByTestId('saldo')).toHaveText('800 g');

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
  await expect(page.locator('.cartao', { hasText: 'Matrizes de origem' })).toContainText('MT-9001');

  await ctx.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const [lote] = (await lerDoServidor('lote_sementes')).filter((l) => l.peso_g === 800);
  expect(lote).toMatchObject({ peso_g: 800, germinacao_teste_pct: 85 });
  expect(String(lote.codigo)).toMatch(/^LS-\d{4}-\d{3}$/);
  const movs = (await lerDoServidor('movimento_sementes')).filter((m) => m.lote_sementes_id === lote.id);
  expect(movs.map((m) => m.tipo).sort()).toEqual(['entrada', 'teste']);
  await ctx.close();
});
