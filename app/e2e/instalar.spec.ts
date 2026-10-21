import { expect, test } from '@playwright/test';
import { entrarComoGestora } from './apoio';

test('botão "Baixar o app" na entrada leva à instalação, mesmo sem login', async ({ page }) => {
  await page.goto('/');
  const botao = page.getByRole('button', { name: /Baixar o app/ });
  await expect(botao).toBeVisible();
  await botao.click();
  // Sem o aviso de instalação do navegador (como neste teste), abre o passo a passo.
  await expect(page).toHaveURL(/\/instalar$/);
  await expect(page.getByRole('heading', { name: 'Baixar o CRAD' })).toBeVisible();
});

test('o link do WhatsApp abre a página de baixar: o passo a passo do aparelho vem primeiro', async ({ browser }) => {
  // celular Android
  const android = await browser.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' });
  const a = await android.newPage();
  await a.goto('/instalar');
  await expect(a.locator('section[data-testid="passos-android"]')).toContainText('Instalar app');
  await expect(a.locator('details[data-testid="passos-iphone"]')).toBeVisible();
  await expect(a.locator('details[data-testid="passos-computador"]')).toBeVisible();
  // a mensagem pronta do WhatsApp leva a esta página
  const href = await a.getByRole('link', { name: 'Enviar pelo WhatsApp' }).getAttribute('href');
  expect(decodeURIComponent(href!.replace('https://wa.me/?text=', ''))).toContain(`*CRAD*`);
  expect(decodeURIComponent(href!)).toContain(`${new URL(a.url()).origin}/instalar`);
  await android.close();

  // computador
  const pc = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0', isMobile: false, hasTouch: false });
  await pc.goto('/instalar');
  await expect(pc.locator('section[data-testid="passos-computador"]')).toContainText('Edge');
  await pc.getByRole('link', { name: 'Abrir o app agora' }).click();
  await expect(pc.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await pc.close();
});

test('o gestor encaminha o app pelo WhatsApp a partir de Ajustes', async ({ page }) => {
  await entrarComoGestora(page);
  await page.goto('/configuracoes');
  const href = await page.getByTestId('convidar-whatsapp').getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(href!)).toContain('/instalar');
});
