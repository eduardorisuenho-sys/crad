import { expect, test } from '@playwright/test';

const PB = () => process.env.CRADS_PB_URL!;

test('o app abre e grava sem internet, e envia quando o sinal volta', async ({ page, context }) => {
  // 1. Primeiro acesso, com internet: entra e o app fica guardado no aparelho.
  await page.goto('/');
  await page.getByRole('group').getByText('Endereço do servidor').click();
  await page.getByLabel('Endereço do servidor').fill(PB());
  await page.getByLabel('E-mail').fill('gestora@teste.local');
  await page.getByLabel('Senha').fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Gestora' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado');

  // 2. Sem sinal: o app abre do zero e continua funcionando.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Gestora' })).toBeVisible();
  await expect(page.getByTestId('barra-sync')).toContainText('Sem sinal');

  await page.getByRole('link', { name: 'Viveiros' }).click();
  await page.getByRole('button', { name: 'Novo viveiro' }).click();
  await page.getByLabel('Nome').fill('Viveiro de Palmas');
  await page.getByLabel('Sigla').fill('pal');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Viveiro de Palmas')).toBeVisible();
  await expect(page.getByText('não enviado')).toBeVisible();
  await expect(page.getByTestId('barra-sync')).toContainText('1 guardado');

  // Fechar e abrir de novo, ainda sem sinal: nada se perde.
  await page.reload();
  await expect(page.getByText('Viveiro de Palmas')).toBeVisible();

  // 3. O sinal volta: envia sozinho.
  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await expect(page.getByText('não enviado')).toHaveCount(0);

  const r = await fetch(`${PB()}/api/collections/viveiro/records`, { headers: { authorization: process.env.CRADS_PB_ADMIN! } });
  const { items } = await r.json();
  expect(items).toEqual([expect.objectContaining({ nome: 'Viveiro de Palmas', sigla: 'PAL', versao: 1 })]);
});
