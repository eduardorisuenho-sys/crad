import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoGestora, entrarComoSolicitante, lerDoServidor } from './apoio';

const foto = fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url));
const LOCAL = { latitude: -10.18, longitude: -48.33, accuracy: 7 };

test('solicitante registra o plantio e o acompanhamento sem internet; foto longe do local fica para conferência; vistoria da gestora', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: LOCAL });
  const s = await ctx.newPage();
  await entrarComoSolicitante(s);
  await expect(s.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await ctx.setOffline(true);
  await abrirModulo(s, 'Pós-plantio');
  await s.locator('.item-lista', { hasText: 'DO-2026-901' }).click();

  await s.getByLabel('Plantadas de Árvore-da-doação').fill('25');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await expect(s.getByText('Foram entregues 20 mudas de Árvore-da-doação.')).toBeVisible();
  await s.getByLabel('Plantadas de Árvore-da-doação').fill('18');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByRole('button', { name: 'Estou no local: marcar o ponto' }).click();
  await expect(s.getByRole('button', { name: /Ponto marcado/ })).toBeVisible();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await expect(s.getByRole('button', { name: 'Salvar plantio' })).toBeDisabled();
  await s.locator('label', { hasText: 'Tirar foto' }).locator('input').setInputFiles(foto);
  await expect(s.locator('.galeria figcaption')).toContainText('GPS ±7 m');
  await s.getByRole('button', { name: 'Salvar plantio' }).click();
  await expect(s.getByText('Plantio registrado')).toBeVisible();
  await expect(s.getByTestId('sobrevivencia')).toContainText('ainda sem acompanhamento');

  // acompanhamento, com uma foto tirada a uns 3 km do local
  await s.getByRole('link', { name: 'Novo acompanhamento' }).click();
  await ctx.setGeolocation({ ...LOCAL, latitude: LOCAL.latitude + 0.03 });
  await s.getByLabel('Vivas de Árvore-da-doação').fill('19');
  await s.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(s.getByText('Foram plantadas 18 mudas de Árvore-da-doação.')).toBeVisible();
  await s.getByLabel('Vivas de Árvore-da-doação').fill('15');
  await s.waitForTimeout(500);
  await s.locator('label', { hasText: 'Tirar foto' }).locator('input').setInputFiles(foto);
  await s.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(s.getByTestId('sobrevivencia')).toContainText('83,3% (15 vivas, relato');
  await expect(s.getByTestId('legenda-foto').filter({ hasText: 'conferir' })).toContainText(/foto a 3\d{3} m do local/);

  await ctx.setOffline(false);
  await expect(s.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const [plantio] = await lerDoServidor('plantio');
  expect(plantio.geometria).toEqual({ type: 'Point', coordinates: [LOCAL.longitude, LOCAL.latitude] });
  expect((await lerDoServidor('plantio_item')).map((i) => i.quantidade)).toEqual([18]);
  expect((await lerDoServidor('monitoramento_item')).map((i) => i.vivas)).toEqual([15]);
  expect((await lerDoServidor('foto')).filter((f) => f.entidade === 'plantio' || f.entidade === 'monitoramento')).toHaveLength(2);
  await ctx.close();

  // ---- vistoria da gestora
  const cg = await browser.newContext({ permissions: ['geolocation'], geolocation: LOCAL });
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.goto('/pos-plantio');
  await expect(g.locator('.item-lista', { hasText: 'DO-2026-901' })).toContainText('83,3% vivas');
  await g.locator('.item-lista', { hasText: 'DO-2026-901' }).click();
  await g.getByRole('link', { name: 'Vistoria' }).click();
  await g.getByLabel('Vivas de Árvore-da-doação').fill('12');
  await g.getByRole('button', { name: 'Salvar acompanhamento' }).click();
  await expect(g.getByTestId('sobrevivencia')).toContainText('66,7% (12 vivas, vistoria');
  await cg.close();
});
