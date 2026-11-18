import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor } from './apoio';

const pdf = fileURLToPath(new URL('./fixtures/manual.pdf', import.meta.url));

test('o viveirista abre o manual do pequi pelo Viveiro; fica guardado no celular', async ({ page, context }) => {
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await abrirModulo(page, 'Viveiro');
  await page.getByTestId('manual-viveirista').click();
  const pequi = page.locator('.manual', { hasText: 'Germinação de Pequi' });
  await expect(pequi).toContainText('Germinação de sementes');
  await expect(pequi).toContainText('Embrapa Cerrados');
  const [janela] = await Promise.all([context.waitForEvent('page'), pequi.getByRole('button', { name: 'Abrir o manual (PDF)' }).click()]);
  await expect.poll(() => janela.url()).toMatch(/^blob:/);
  await expect(pequi).toContainText('guardado no celular');
  // só o gestor inclui e tira manuais
  await expect(page.getByRole('button', { name: /Incluir manual/ })).toHaveCount(0);
});

test('quem só pede mudas também lê o manual (pela Ajuda)', async ({ page }) => {
  await entrarComoSolicitante(page);
  await page.goto('/ajuda');
  await page.getByRole('link', { name: /Manual do viveirista/ }).click();
  await expect(page.locator('.manual', { hasText: 'Germinação de Pequi' })).toBeVisible({ timeout: 20_000 });
});

test('o gestor inclui um manual em PDF e tira', async ({ page }) => {
  await entrarComoGestora(page);
  await page.goto('/manuais');
  await page.getByRole('button', { name: /Incluir manual/ }).click();
  const form = page.getByTestId('form-manual');
  await form.getByLabel('Título').fill('Produção de mudas em tubete');
  await form.getByRole('button', { name: 'Produção de mudas' }).click();
  await form.getByLabel(/Arquivo PDF/).setInputFiles(pdf);
  await form.getByRole('button', { name: 'Salvar manual' }).click();
  await expect(page.locator('.manual', { hasText: 'Produção de mudas em tubete' })).toBeVisible();
  await expect
    .poll(async () => (await lerDoServidor('manual')).find((m) => m.titulo === 'Produção de mudas em tubete')?.arquivo, { timeout: 20_000 })
    .toMatch(/\.pdf$/);
  page.once('dialog', (d) => void d.accept());
  await page.locator('.manual', { hasText: 'Produção de mudas em tubete' }).getByRole('button', { name: 'Tirar este manual' }).click();
  await expect(page.locator('.manual', { hasText: 'Produção de mudas em tubete' })).toHaveCount(0);
  await expect.poll(async () => (await lerDoServidor('manual')).find((m) => m.titulo === 'Produção de mudas em tubete')?.excluido, { timeout: 20_000 }).toBe(true);
});
