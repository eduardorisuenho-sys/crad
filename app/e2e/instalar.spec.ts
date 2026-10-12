import { expect, test } from '@playwright/test';

test('botão "Baixar o app" na entrada leva à instalação, mesmo sem login', async ({ page }) => {
  await page.goto('/');
  const botao = page.getByRole('button', { name: /Baixar o app/ });
  await expect(botao).toBeVisible();
  await botao.click();
  // Sem o aviso de instalação do navegador (como neste teste), abre o passo a passo.
  await expect(page).toHaveURL(/\/instalar$/);
  await expect(page.getByRole('heading', { name: 'Instalar o CRADS' })).toBeVisible();
});
