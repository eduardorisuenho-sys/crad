import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { entrarComoColetor } from './apoio';

test('coletor registra uma coleta e baixa o relatório de serviço em PDF, sem internet', async ({ page, context }) => {
  await entrarComoColetor(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await context.setOffline(true);
  const matrizId = await page.evaluate(async () => {
    const req = indexedDB.open('crads');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const todas: { id: string; codigo: string }[] = await new Promise((ok) => {
      const r = db.transaction('matriz').objectStore('matriz').getAll();
      r.onsuccess = () => ok(r.result);
    });
    return todas.find((m) => m.codigo === 'MT-9001')!.id;
  });
  await page.goto(`/coleta/nova?matriz=${matrizId}`);
  await page.getByLabel('Quantidade').fill('3');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Sementes' }).click();
  await page.getByRole('button', { name: 'Pular a foto' }).click();
  await page.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(page.getByText('Coleta salva')).toBeVisible();

  await page.getByRole('link', { name: 'Relatório de serviço' }).click();
  const resumo = page.getByTestId('resumo-servico');
  await expect(resumo.locator('li', { hasText: 'Coletas' }).locator('strong')).not.toHaveText('0');
  await expect(page.getByTestId('recorte-servico')).toContainText('Coletor');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar relatório em PDF' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^relatorio-coletor-coletor-.*\.pdf$/);
  const bytes = readFileSync((await pdf.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  expect(bytes.toString('latin1')).toContain('Coletor Teste');
});
