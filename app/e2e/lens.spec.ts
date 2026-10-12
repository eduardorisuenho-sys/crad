import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoColetor, PB } from './apoio';

const foto = fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url));

test('matriz a identificar: foto vai para o Google Lens e a espécie sugerida fica como provável', async ({ browser }) => {
  // Matriz sem espécie, com uma foto no servidor (tirada em outro aparelho).
  const admin = { authorization: process.env.CRADS_PB_ADMIN! };
  const m = await (await fetch(`${PB()}/api/collections/matriz/records`, {
    method: 'POST',
    headers: { ...admin, 'content-type': 'application/json' },
    body: JSON.stringify({ codigo: 'MT-9555', grau_certeza: 'a_identificar', viveiro_id: 'vivteste0000001' }),
  })).json();
  const form = new FormData();
  for (const [k, v] of Object.entries({ entidade: 'matriz', registro_id: m.id, parte: 'arvore', viveiro_id: 'vivteste0000001' })) form.append(k, v);
  form.append('arquivo', new Blob([readFileSync(foto)], { type: 'image/jpeg' }), 'arvore.jpg');
  expect((await fetch(`${PB()}/api/collections/foto/records`, { method: 'POST', headers: admin, body: form })).status).toBe(200);

  // No computador (sem "Compartilhar"), a foto é baixada e o Lens abre noutra aba.
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route('https://lens.google.com/**', (r) => r.fulfill({ body: 'Google Lens (simulado no teste)', contentType: 'text/html' }));
  const page = await ctx.newPage();
  await entrarComoColetor(page);
  await page.goto(`/matrizes/${m.id}`);
  const ajuda = page.getByTestId('ajuda-lens');
  const [download, aba] = await Promise.all([page.waitForEvent('download'), ctx.waitForEvent('page'), ajuda.getByRole('button', { name: 'Pesquisar no Google Lens' }).click()]);
  expect(download.suggestedFilename()).toBe('MT-9555.jpg');
  expect(aba.url()).toContain('lens.google.com');
  await aba.close();
  await expect(page.getByTestId('lens-msg')).toContainText('arraste a foto');

  await ajuda.getByRole('button', { name: 'Escolher a espécie sugerida' }).click();
  await page.getByLabel('Nome da espécie').fill('campo ficticia');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await expect(page.getByText('Espécie sugerida registrada como provável')).toBeVisible();
  await expect(page.locator('.ficha')).toContainText('com ajuda do Google Lens');
  await ctx.close();
});
