import { expect, type Page } from '@playwright/test';

export const PB = () => process.env.CRADS_PB_URL!;

/** Entra (com internet) e espera o app ficar guardado no aparelho. */
export async function entrar(page: Page, email: string, saudacao: string) {
  await page.goto('/');
  await page.getByRole('group').getByText('Endereço do servidor').click();
  await page.getByLabel('Endereço do servidor').fill(PB());
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: saudacao })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
}

export const entrarComoGestora = (page: Page) => entrar(page, 'gestora@teste.local', 'Olá, Gestora');
export const entrarComoColetor = (page: Page) => entrar(page, 'coletor@teste.local', 'Olá, Coletor');

export async function lerDoServidor(colecao: string) {
  const r = await fetch(`${PB()}/api/collections/${colecao}/records?perPage=500`, { headers: { authorization: process.env.CRADS_PB_ADMIN! } });
  return (await r.json()).items as Record<string, unknown>[];
}
