import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

const modelo = fileURLToPath(new URL('../../dados/modelo-especies.xlsx', import.meta.url));

test('gestora importa o modelo de planilha sem internet e as espécies sobem quando o sinal volta', async ({ page, context }) => {
  await entrarComoGestora(page);
  await context.setOffline(true);

  await page.getByRole('link', { name: 'Espécies' }).click();
  await page.getByRole('link', { name: 'Importar' }).click();
  await page.locator('input[type=file]').setInputFiles(modelo);
  const previa = page.getByTestId('previa');
  await expect(previa).toContainText('Espécies novas');
  await expect(previa.locator('dd').nth(2)).toHaveText('1');
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByText('1 espécies novas')).toBeVisible();
  await page.getByRole('button', { name: 'Ver espécies' }).click();

  await page.getByLabel('Buscar espécie').fill('arvore de exemplo');
  await expect(page.getByText('Árvore-de-exemplo')).toBeVisible();
  await expect(page.getByText('fictícia', { exact: true })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  // (outros testes rodam ao mesmo tempo no mesmo servidor: filtra pelo que este teste importou)
  const especies = (await lerDoServidor('especie')).filter((e) => e.fonte_cadastro === 'planilha');
  expect(especies).toEqual([expect.objectContaining({ nome_cientifico: 'Ficticia exemplaris Fulano', ficticia: true, publicada: false, meses_flor: [9, 10, 11] })]);
  expect((await lerDoServidor('nome_popular')).filter((n) => n.especie_id === especies[0].id).map((n) => n.nome)).toEqual(['Árvore-de-exemplo']);
});
