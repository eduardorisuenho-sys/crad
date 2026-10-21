import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoColetor, PB } from './apoio';

test('vídeos de ajuda abrem sem login, a partir da tela de entrar', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await page.reload();
  await page.getByRole('link', { name: 'Vídeos de ajuda' }).click();
  await expect(page.getByRole('heading', { name: 'Para começar' })).toBeVisible();
  await page.getByRole('link', { name: 'Episódio 1: Criar conta e entrar' }).click();
  await expect(page.locator('video.video-ajuda')).toHaveAttribute('src', '/ajuda/01-conta.mp4');
  await page.getByRole('link', { name: /Próximo: A tela inicial/ }).click();
  await expect(page.locator('video.video-ajuda')).toHaveAttribute('src', '/ajuda/02-inicio.mp4');
});

test('o coletor vê os vídeos dele primeiro e guarda um para ver sem internet', async ({ page, context }) => {
  await entrarComoColetor(page);
  await abrirModulo(page, 'Ajuda');
  const paraVoce = page.locator('.lista-videos').first();
  await expect(paraVoce.getByRole('link')).toHaveText([/Criar conta/, /A tela inicial/, /Cadastrar uma matriz/, /Registrar uma coleta/]);
  await expect(page.getByRole('heading', { name: 'Outros vídeos' })).toBeVisible();

  await paraVoce.getByRole('link', { name: /Cadastrar uma matriz/ }).click();
  await expect(page.locator('.perfis-video .selo')).toHaveText(['Coletor']);
  await page.getByTestId('guardar-video').click();
  await expect(page.getByText('Guardado no celular: abre mesmo sem internet.')).toBeVisible();
  await expect(page.getByTestId('guardar-video')).toHaveText(/Tirar do celular/);

  // sem sinal, o service worker entrega o vídeo guardado em pedaços, como o player pede
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  const pedaco = await page.evaluate(async () => {
    const r = await fetch('/ajuda/03-matriz.mp4', { headers: { Range: 'bytes=0-99' } });
    return { status: r.status, tamanho: (await r.arrayBuffer()).byteLength, faixa: r.headers.get('Content-Range') };
  });
  expect(pedaco).toMatchObject({ status: 206, tamanho: 100, faixa: expect.stringMatching(/^bytes 0-99\/\d+$/) });
  await context.setOffline(false);

  // na lista aparece como guardado; tirar do celular libera o espaço
  await page.goto('/ajuda');
  await expect(page.getByRole('link', { name: /Cadastrar uma matriz/ })).toContainText('guardado no celular');
  await page.getByRole('link', { name: /Cadastrar uma matriz/ }).click();
  await page.getByTestId('guardar-video').click();
  await expect(page.getByTestId('guardar-video')).toHaveText(/Guardar para ver sem internet/);
});
