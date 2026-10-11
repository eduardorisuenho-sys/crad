import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

// Municípios fictícios de teste (quadrados), no lugar dos arquivos do IBGE.
const malha = fileURLToPath(new URL('./fixtures/malha-teste.geojson', import.meta.url));
const nomes = fileURLToPath(new URL('./fixtures/nomes-teste.json', import.meta.url));

test('gestora importa os municípios do IBGE e eles vão para o servidor; importar de novo não duplica', async ({ page }) => {
  // "Baixar do IBGE" respondido com os arquivos de teste.
  await page.route('https://servicodados.ibge.gov.br/api/v3/malhas/**', (r) => r.fulfill({ path: malha, contentType: 'application/json' }));
  await page.route('https://servicodados.ibge.gov.br/api/v1/localidades/**', (r) => r.fulfill({ path: nomes, contentType: 'application/json' }));
  await entrarComoGestora(page);
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Municípios (IBGE)' }).click();
  await page.getByRole('button', { name: 'Baixar do IBGE' }).click();
  const previa = page.getByTestId('previa-municipios');
  await expect(previa).toContainText('Novos2');
  await page.getByRole('button', { name: 'Gravar' }).click();
  await expect(page.getByText('2 municípios novos e 0 atualizados.')).toBeVisible();
  await expect(page.getByTestId('total-municipios')).toHaveText('2');
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const doServidor = (await lerDoServidor('municipio')).filter((m) => String(m.codigo_ibge).startsWith('17999'));
  expect(doServidor.map((m) => m.nome).sort()).toEqual(['Município Teste Leste', 'Município Teste Oeste']);
  expect(doServidor[0].contorno).toMatchObject({ type: 'Polygon' });

  // Pelos arquivos, sem internet para o IBGE: nada muda.
  await page.goto('/municipios');
  await page.locator('input[type=file]').setInputFiles([malha, nomes]);
  await expect(previa).toContainText('Novos0');
  await expect(previa).toContainText('Sem mudança2');
  await expect(page.getByRole('button', { name: 'Gravar' })).toBeDisabled();
});
