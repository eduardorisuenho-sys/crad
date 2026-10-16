import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, PB } from './apoio';

const foto = fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url));

test('catálogo público sem login: mudas prontas, ficha com foto, rastreio sem dados pessoais e cópia para ver sem internet', async ({ page, browser }) => {
  // A gestora envia a foto da muda na ficha da espécie.
  await entrarComoGestora(page);
  await page.goto(`/especies/${process.env.CRADS_ESPECIE_PUBLICA}`);
  await page.locator('label.chip', { hasText: 'Muda' }).locator('input').setInputFiles(foto);
  await expect(page.locator('.galeria figure')).toHaveCount(1);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });

  // Visitante, sem login.
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/');
  // o visitante usa o servidor de teste
  await p.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await p.getByRole('link', { name: 'Ver o catálogo de mudas (sem login)' }).click();
  // botão Voltar no catálogo de quem não fez login: volta para a entrada
  await p.getByRole('button', { name: 'Voltar' }).click();
  await expect(p.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await p.getByRole('link', { name: 'Ver o catálogo de mudas (sem login)' }).click();
  const cartao = p.locator('.cartao-especie', { hasText: 'Árvore-do-catálogo' });
  await expect(cartao).toContainText('60 mudas');
  await expect(cartao.locator('img')).toHaveJSProperty('complete', true);
  expect(await cartao.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  // nenhum selo de "teste" no catálogo
  await expect(p.locator('main')).not.toContainText('(teste)');

  await cartao.click();
  await expect(p.getByTestId('onde-tem')).toContainText('Viveiro Teste: 60 mudas');
  const cadeia = p.getByTestId('cadeia');
  await expect(cadeia).toContainText('Sementes de 1 árvore(s) matriz(es)');
  await expect(cadeia).toContainText('LS-2026-901');
  await expect(cadeia).toContainText('LM-2026-901-A');
  const texto = await p.locator('main').innerText();
  expect(texto).not.toMatch(/MT-9002|-10[.,]3|-48[.,]3/);

  // Rastreio pelo código
  await p.goto('/catalogo');
  await p.getByLabel('Código do lote de mudas').fill('lm-2026-901-a');
  await p.getByRole('button', { name: 'Ver de onde vieram as sementes' }).click();
  await expect(p.getByTestId('cadeia')).toContainText('LS-2026-901');

  // Sem internet: o catálogo abre pela cópia guardada.
  await p.goto('/catalogo');
  await expect(p.locator('.cartao-especie', { hasText: 'Árvore-do-catálogo' })).toBeVisible();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await p.reload();
  await expect(p.getByText(/Sem internet: mostrando o catálogo de/)).toBeVisible();
  await expect(p.locator('.cartao-especie', { hasText: 'Árvore-do-catálogo' })).toContainText('60 mudas');
  await ctx.close();
});
