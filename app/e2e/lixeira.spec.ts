import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

test('administradora exclui um cadastro errado, vê na lixeira e apaga de vez', async ({ page }) => {
  // Uma matriz preenchida errado (criada "pelo painel" só para o teste).
  const r = await fetch(`${PB()}/api/collections/matriz/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: process.env.CRADS_PB_ADMIN! },
    body: JSON.stringify({ codigo: 'MT-9777', grau_certeza: 'a_identificar', viveiro_id: 'vivteste0000001' }),
  });
  const { id } = await r.json();
  page.on('dialog', (d) => void d.accept());
  await entrarComoGestora(page);
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Corrigir cadastros e lixeira' }).click();
  await page.getByLabel('Procurar cadastro').fill('9777');
  await page.getByTestId('cadastros').locator('li', { hasText: 'MT-9777' }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('MT-9777 foi para a lixeira.')).toBeVisible();
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(async () => (await lerDoServidor('matriz')).find((m) => m.id === id)?.excluido).toBe(true);

  await page.getByRole('group', { name: 'Aba' }).getByRole('button', { name: 'Lixeira' }).click();
  const item = page.getByTestId('lixeira').locator('li', { hasText: 'MT-9777' });
  await expect(item).toContainText('Matrizes');
  await item.getByRole('button', { name: 'Apagar de vez' }).click();
  await expect(page.getByText('MT-9777 foi apagado de vez.')).toBeVisible();
  expect((await lerDoServidor('matriz')).some((m) => m.id === id)).toBe(false);
});

test('administradora exclui vários cadastros de uma vez e apaga de vez vários da lixeira', async ({ page }) => {
  const ids: string[] = [];
  for (const codigo of ['MT-9781', 'MT-9782', 'MT-9783']) {
    const r = await fetch(`${PB()}/api/collections/matriz/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: process.env.CRADS_PB_ADMIN! },
      body: JSON.stringify({ codigo, grau_certeza: 'a_identificar', viveiro_id: 'vivteste0000001' }),
    });
    ids.push((await r.json()).id);
  }
  page.on('dialog', (d) => void d.accept());
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await page.goto('/lixeira');
  await page.getByLabel('Procurar cadastro').fill('MT-978');
  await expect(page.getByTestId('cadastros').locator('li')).toHaveCount(3);
  await page.getByLabel(/Selecionar todos/).check();
  await page.getByRole('button', { name: 'Excluir selecionados (3)' }).click();
  await expect(page.getByText('3 cadastro(s) foram para a lixeira.')).toBeVisible();
  await expect.poll(async () => (await lerDoServidor('matriz')).filter((m) => ids.includes(String(m.id)) && m.excluido).length, { timeout: 20_000 }).toBe(3);

  await page.getByRole('group', { name: 'Aba' }).getByRole('button', { name: 'Lixeira' }).click();
  for (const c of ['MT-9781', 'MT-9782']) await page.getByLabel(`Selecionar ${c}`).check();
  await page.getByRole('button', { name: 'Apagar de vez selecionados (2)' }).click();
  await expect(page.getByText('2 item(ns) apagados de vez.')).toBeVisible();
  await page.getByLabel('Selecionar MT-9783').check();
  await page.getByRole('button', { name: 'Restaurar selecionados (1)' }).click();
  await expect(page.getByText('1 item(ns) voltaram.')).toBeVisible();
  const restantes = (await lerDoServidor('matriz')).filter((m) => ids.includes(String(m.id)));
  expect(restantes).toEqual([expect.objectContaining({ codigo: 'MT-9783', excluido: false })]);
});
