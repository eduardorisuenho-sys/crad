import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, entrarComoSolicitante, PB } from './apoio';

test('gestora vê os indicadores e baixa planilha e mapa sem internet; rastreia uma doação até a matriz', async ({ browser }) => {
  const ctx = await browser.newContext();
  const g = await ctx.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await g.goto('/relatorios');
  await g.getByRole('button', { name: 'Tudo' }).click();
  const cartoes = g.getByTestId('indicadores');
  await expect(cartoes).toContainText('Matrizes');
  await expect(cartoes.locator('li', { hasText: 'Mudas doadas' }).locator('strong')).not.toHaveText('0');

  await g.getByRole('button', { name: 'Só Plantando Água' }).click();
  await expect(g.getByTestId('recorte')).toContainText('Plantando Água');
  await g.getByRole('button', { name: 'Só Plantando Água' }).click();

  const [planilha] = await Promise.all([g.waitForEvent('download'), g.getByRole('button', { name: 'Planilha' }).click()]);
  expect(planilha.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(readFileSync((await planilha.path())!).subarray(0, 2).toString()).toBe('PK');

  const [mapa] = await Promise.all([g.waitForEvent('download'), g.getByRole('button', { name: 'Mapa (KML)' }).click()]);
  const kml = readFileSync((await mapa.path())!, 'utf8');
  expect(kml).toContain('<kml');
  expect(kml).toContain('MT-9001');
  expect(kml).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // nenhum CPF

  await g.getByRole('link', { name: 'Rastrear um código' }).click();
  await g.getByLabel('Código').fill('do-2026-901');
  await g.getByRole('button', { name: 'Rastrear' }).click();
  const cadeia = g.getByTestId('cadeia');
  await expect(cadeia).toContainText('LM-2026-902-A');
  await expect(cadeia).toContainText('LS-2026-901');
  await expect(cadeia).toContainText('MT-9002');
  await expect(cadeia).not.toContainText('LM-2026-901-A');
  await ctx.close();
});

test('transparência: só com login (sem login não há link nem dados) e guarda cópia para ver sem internet', async ({ browser }) => {
  // sem login: nenhum link, o endereço leva à entrada e o servidor não entrega os dados
  const cv = await browser.newContext();
  const visitante = await cv.newPage();
  await visitante.goto('/');
  await visitante.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await expect(visitante.getByRole('link', { name: /transparência/ })).toHaveCount(0);
  await visitante.goto('/catalogo');
  await expect(visitante.getByRole('link', { name: /transparência/ })).toHaveCount(0);
  await visitante.goto('/transparencia');
  await expect(visitante.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(visitante.getByTestId('transparencia')).toHaveCount(0);
  expect((await fetch(`${PB()}/api/crads/publico/transparencia`)).status).toBe(401);
  await cv.close();

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await entrarComoSolicitante(p);
  await p.goto('/catalogo');
  await p.getByRole('link', { name: /transparência/ }).click();
  const t = p.getByTestId('transparencia');
  await expect(t).toContainText('Mudas doadas');
  const doadas = Number((await t.locator('li', { hasText: 'Mudas doadas' }).locator('strong').innerText()).replace(/\D/g, ''));
  expect(doadas).toBeGreaterThanOrEqual(20);
  await expect(p.getByText('Árvore-da-doação')).toBeVisible();
  // nada de dados pessoais na página
  await expect(p.locator('body')).not.toContainText('Solicitante Teste');

  await p.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await p.reload();
  await expect(p.getByText(/Sem internet: mostrando os dados/)).toBeVisible();
  await expect(p.getByTestId('transparencia')).toContainText('Mudas doadas');
  await ctx.close();
});
