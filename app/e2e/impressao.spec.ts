import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import { entrarComoSolicitante, entrarComoViveirista, PB } from './apoio';

/** Conteúdo do PDF baixado (o jsPDF grava o texto sem compressão, em latin1). */
async function lerPdf(d: Download): Promise<{ texto: string; paginas: number }> {
  const caminho = await d.path();
  if (process.env.CRADS_PASTA_PDF) await d.saveAs(`${process.env.CRADS_PASTA_PDF}/${d.suggestedFilename()}`);
  const texto = (await readFile(caminho)).toString('latin1');
  return { texto, paginas: texto.match(/\/Type \/Page\b/g)?.length ?? 0 };
}

test('imprimir: catálogo com fotos, fichas das espécies do pedido e etiquetas com QR das mudas', async ({ browser }) => {
  // ---- visitante: catálogo inteiro em PDF
  const cv = await browser.newContext({ acceptDownloads: true });
  const p = await cv.newPage();
  await p.goto('/');
  await p.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await p.goto('/catalogo');
  await expect(p.locator('.cartao-especie', { hasText: 'Árvore-do-catálogo' })).toBeVisible();
  const [cat] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Imprimir o catálogo com fotos/ }).click()]);
  expect(cat.suggestedFilename()).toBe('catalogo-de-mudas.pdf');
  const c = await lerPdf(cat);
  expect(c.texto.startsWith('%PDF')).toBe(true);
  expect(c.texto).toContain('Catálogo de mudas nativas');
  expect(c.texto).toContain('Árvore-do-catálogo');
  expect(c.texto).toContain('Catalogia demonstrativa');
  expect(c.texto).toMatch(/\d+ mudas prontas/);
  // espécie fictícia de treino nunca entra no catálogo
  expect(c.texto).not.toContain('Árvore-de-campo-fictícia');
  await cv.close();

  // ---- solicitante: fichas das espécies do pedido, com as quantidades
  const cs = await browser.newContext({ acceptDownloads: true });
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await expect(s.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await s.goto('/doacao');
  await s.locator('.item-lista', { hasText: 'DO-2026-901' }).click();
  const [fichas] = await Promise.all([s.waitForEvent('download'), s.getByRole('button', { name: 'Fichas das espécies com fotos (PDF)' }).click()]);
  expect(fichas.suggestedFilename()).toBe('especies-DO-2026-901.pdf');
  const f = await lerPdf(fichas);
  expect(f.texto).toContain('Espécies do pedido DO-2026-901');
  expect(f.texto).toContain('Árvore-da-doação');
  expect(f.texto).toContain('Pedidas: 20 · Aprovadas: 20 · Entregues: 20');
  await cs.close();

  // ---- viveirista: etiquetas com QR para fixar nas mudas
  const cw = await browser.newContext({ acceptDownloads: true });
  const w = await cw.newPage();
  await entrarComoViveirista(w);
  await expect(w.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await w.goto('/viveiro');
  await w.getByText('LM-2026-901-A').first().click();
  const cartao = w.getByTestId('etiquetas-lm');
  await cartao.getByLabel('Quantas etiquetas?').fill('30');
  const [etq] = await Promise.all([w.waitForEvent('download'), cartao.getByRole('button', { name: 'Imprimir etiquetas (PDF)' }).click()]);
  expect(etq.suggestedFilename()).toBe('etiquetas-LM-2026-901-A.pdf');
  const e = await lerPdf(etq);
  expect(e.paginas).toBe(2); // 24 por folha
  expect(e.texto.split('(LM-2026-901-A)').length - 1).toBe(30);
  expect(e.texto).toContain('Árvore-do-catálogo');
  expect(e.texto).toContain('Viveiro Teste');
  expect(e.texto).toContain('Semeado em 01/02/2026');
  await cw.close();
});
