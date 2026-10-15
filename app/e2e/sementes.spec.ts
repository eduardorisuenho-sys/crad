import { expect, test } from '@playwright/test';
import { entrarComoColetor, entrarComoGestora, entrarComoViveirista, lerDoServidor } from './apoio';

test.use({ permissions: ['geolocation'], geolocation: { latitude: -10.2, longitude: -48.35, accuracy: 8 } });

test('botão Coleta: sem matriz e sem localização, também para sementes guardadas antes do app', async ({ page, browser }) => {
  // ---- coletor: árvore sem matriz, sem internet
  const cc = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -10.2, longitude: -48.35, accuracy: 8 } });
  const c = await cc.newPage();
  await entrarComoColetor(c);
  await expect(c.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await cc.setOffline(true);
  await c.goto('/coleta/nova');
  await expect(c.getByRole('button', { name: /Registrar sementes|Sementes guardadas/ })).toHaveCount(0);
  await expect(c.getByRole('link', { name: /Sementes guardadas/ })).toHaveCount(0);
  const botao = c.getByRole('button', { name: /^Coleta/ });
  await expect(botao).toHaveClass(/verde/);
  await botao.click();
  await c.getByLabel('Nome da espécie').fill('arvore do catalogo');
  await c.getByRole('button', { name: /Árvore-do-catálogo/ }).click();
  await expect(c.getByText('Coleta sem matriz · Árvore-do-catálogo')).toBeVisible();
  await c.getByLabel('Quantidade').fill('3');
  await c.getByRole('button', { name: 'Quilos (kg)' }).click();
  await c.getByRole('button', { name: 'Continuar' }).click();
  await c.getByRole('button', { name: 'Sementes' }).click();
  await c.getByRole('button', { name: 'Pular a foto' }).click();
  await expect(c.locator('.ficha')).toContainText('sem matriz cadastrada · Árvore-do-catálogo');
  await expect(c.locator('.ficha')).not.toContainText('Local');
  await c.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(c.getByText('Coleta salva')).toBeVisible();
  await expect(c.locator('.item-lista', { hasText: 'Sem matriz · Árvore-do-catálogo' })).toContainText('3 kg');
  await cc.setOffline(false);
  await expect.poll(async () => (await lerDoServidor('coleta')).filter((x) => x.quantidade === 3 && !x.matriz_id).length, { timeout: 20_000 }).toBe(1);
  const [coleta] = (await lerDoServidor('coleta')).filter((x) => x.quantidade === 3 && !x.matriz_id);
  expect(coleta).toMatchObject({ unidade: 'kg', material: 'semente' });
  expect(Number(coleta.lat) || null).toBeNull(); // sem localização
  expect(coleta.especie_id).toBeTruthy();
  await cc.close();

  // ---- a coleta sem matriz também vira lote sozinha (rastreável pela coleta)
  await expect.poll(async () => (await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === coleta.id)?.lote_sementes_id, { timeout: 20_000 }).toBeTruthy();
  const loteColeta = String((await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === coleta.id)!.lote_sementes_id);
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto(`/coleta/lotes/${loteColeta}`);
  await expect(page.getByTestId('origem-ls')).toContainText('Árvore sem matriz', { timeout: 20_000 });
  await expect(page.getByTestId('saldo')).toHaveText('3000 g');

  // ---- sementes que já estavam no viveiro: o mesmo botão Coleta, com a data antiga
  await page.goto('/coleta/nova');
  await page.getByRole('button', { name: /^Coleta/ }).click();
  await page.getByLabel('Nome da espécie').fill('arvore do catalogo');
  await page.getByRole('button', { name: /Árvore-do-catálogo/ }).click();
  await page.getByLabel('Quantidade').fill('500');
  await page.getByRole('button', { name: 'Gramas (g)' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Sementes' }).click();
  await page.getByRole('button', { name: 'Pular a foto' }).click();
  await page.getByLabel('Quando foi colhido?').fill('2025-08-10');
  await page.getByLabel(/Observação/).fill('Coleta de 2025 na região de Porto Nacional');
  await page.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(page.getByText('Coleta salva')).toBeVisible();
  await expect.poll(async () => (await lerDoServidor('coleta')).filter((x) => x.quantidade === 500 && !x.matriz_id).length, { timeout: 20_000 }).toBe(1);
  const [antiga] = (await lerDoServidor('coleta')).filter((x) => x.quantidade === 500 && !x.matriz_id);
  expect(String(antiga.data)).toMatch(/^2025-08-10/);
  expect(Number(antiga.lat) || null).toBeNull();
  // vira lote sozinha, rastreável pela coleta, e pode ser semeada
  await expect.poll(async () => (await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === antiga.id)?.lote_sementes_id, { timeout: 20_000 }).toBeTruthy();
  const idLote = String((await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === antiga.id)!.lote_sementes_id);
  const ls = (await lerDoServidor('lote_sementes')).find((l) => l.id === idLote)!;
  expect(String(ls.codigo)).toMatch(/^LS-\d{4}-\d{3}$/);
  await page.goto(`/coleta/lotes/${idLote}`);
  await expect(page.getByTestId('saldo')).toContainText('500 g', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Semear deste lote/ })).toBeVisible();

  // preenchido errado: quem cadastrou exclui na própria ficha (vai para a lixeira)
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /Excluir \(preenchido errado\)/ }).click();
  await expect(page).toHaveURL(/\/coleta$/);
  await expect(page.locator('.item-lista', { hasText: String(ls.codigo) })).toHaveCount(0);
  await expect.poll(async () => (await lerDoServidor('lote_sementes')).find((l) => l.id === ls.id)?.excluido, { timeout: 20_000 }).toBe(true);

  // o que tem algo ativo ligado não é excluído: o lote LM-2026-902-A já entregou mudas numa doação
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  const [lm] = (await lerDoServidor('lote_mudas')).filter((l) => l.codigo === 'LM-2026-902-A');
  await g.goto(`/viveiro/lotes/${String(lm.id)}`);
  await g.getByRole('button', { name: /Excluir \(preenchido errado\)/ }).click();
  await expect(g.getByRole('alert')).toContainText('Ainda há registros ligados');
  expect((await lerDoServidor('lote_mudas')).find((l) => l.id === lm.id)?.excluido).toBe(false);
  await cg.close();
});

test('coleta de frutos contados por unidade', async ({ page }) => {
  await entrarComoColetor(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto('/coleta/nova');
  await page.getByRole('button', { name: /MT-9001/ }).click();
  await page.getByLabel('Quantidade').fill('40');
  await page.getByRole('button', { name: 'Unidades (contadas)' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Frutos' }).click();
  await page.getByRole('button', { name: 'Pular a foto' }).click();
  await expect(page.locator('.ficha')).toContainText('40 unidades (contadas) de frutos');
  await page.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect.poll(async () => (await lerDoServidor('coleta')).some((c) => c.quantidade === 40 && c.unidade === 'unidades' && c.material === 'fruto'), { timeout: 20_000 }).toBe(true);
});
