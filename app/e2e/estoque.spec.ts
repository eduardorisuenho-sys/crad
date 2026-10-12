import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { escreverXlsx } from '../../dominio/src/index';
import { abrirModulo, entrarComoViveirista, lerDoServidor } from './apoio';

test('viveirista cadastra sem internet as mudas que já estavam no viveiro: uma espécie, lista e planilha', async ({ page, context }) => {
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await context.setOffline(true);
  await abrirModulo(page, 'Viveiro');
  await page.getByRole('link', { name: /Mudas que já estavam aqui/ }).click();

  // 1) uma espécie por vez
  await page.getByRole('button', { name: /Uma espécie por vez/ }).click();
  await page.getByLabel('Nome da espécie').fill('campo ficticia');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await page.getByLabel('Quantas mudas?').fill('25');
  await page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Rustificação' }).click();
  await page.getByLabel('Onde estão? (opcional)').fill('canteiro 9');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('estoque-ok')).toContainText('25 mudas de 1 espécie(s)');

  // 2) várias de uma vez
  await page.getByRole('button', { name: 'Outra forma' }).click();
  await page.getByRole('button', { name: /Várias de uma vez/ }).click();
  await page.getByLabel('Quantidade de Árvore-de-campo-fictícia').fill('7');
  await page.getByRole('button', { name: /Salvar todas \(1\)/ }).click();
  await expect(page.getByTestId('estoque-ok')).toContainText('7 mudas de 1 espécie(s)');

  // 3) planilha
  const arquivo = join(tmpdir(), `estoque-${Date.now()}.xlsx`);
  writeFileSync(arquivo, escreverXlsx([{ nome: 'Estoque', linhas: [['Espécie', 'Quantidade', 'Fase'], ['Árvore-de-campo-fictícia', 15, 'Pronta'], ['Espécie que não existe', 3, 'Pronta']] }]));
  await page.getByRole('button', { name: 'Outra forma' }).click();
  await page.getByRole('button', { name: /Importar planilha/ }).click();
  await page.locator('input[type=file]').setInputFiles(arquivo);
  const previa = page.getByTestId('previa-estoque');
  await expect(previa).toContainText('1 linha(s) prontas · 15 mudas');
  await expect(previa).toContainText('Linha 3: espécie "Espécie que não existe" não encontrada');
  await page.getByRole('button', { name: 'Gravar' }).click();
  await expect(page.getByTestId('estoque-ok')).toContainText('15 mudas');

  // volta a internet: o servidor dá os códigos LM-AAAA-I-NNN
  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const lotes = (await lerDoServidor('lote_mudas')).filter((l) => l.origem === 'estoque_inicial');
  expect(lotes.length).toBeGreaterThanOrEqual(3);
  for (const l of lotes) expect(String(l.codigo)).toMatch(/^LM-\d{4}-I-\d{3}$/);
  expect(lotes.find((l) => l.canteiro === 'canteiro 9')?.fase_atual).toBe('rustificacao');

  await page.goto('/viveiro');
  await page.locator('.item-lista', { hasText: /LM-\d{4}-I-/ }).first().click();
  await expect(page.getByTestId('origem-lm')).toContainText('origem das sementes não registrada');
  await expect(page.getByTestId('germinacao')).toHaveCount(0);
});
