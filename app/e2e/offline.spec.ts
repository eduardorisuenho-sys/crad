import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

test('o app abre e grava sem internet, e envia quando o sinal volta', async ({ page, context }) => {
  // 1. Primeiro acesso, com internet: entra e o app fica guardado no aparelho.
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado');

  // 2. Sem sinal: o app abre do zero e continua funcionando.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Gestora' })).toBeVisible();
  await expect(page.getByTestId('barra-sync')).toContainText('Sem sinal');

  await page.getByRole('link', { name: 'Cadastrar viveiros' }).click();
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

  expect((await lerDoServidor('viveiro')).filter((v) => v.sigla === 'PAL')).toEqual([expect.objectContaining({ nome: 'Viveiro de Palmas', versao: 1 })]);
});
