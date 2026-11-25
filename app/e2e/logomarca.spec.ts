import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

const imagem = fileURLToPath(new URL('./fixtures/logomarca.png', import.meta.url));
/** quantas imagens o PDF tem (o símbolo do CRAD + a logomarca da instituição) */
const imagensNoPdf = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length;

test('a logomarca escolhida em Ajustes vai para o rodapé, os documentos em PDF e as telas sem login', async ({ browser }) => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const g = await ctx.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });

  // relatório em PDF antes: só o símbolo do CRAD
  await g.goto('/relatorios');
  const baixarPdf = async () => {
    const [d] = await Promise.all([g.waitForEvent('download'), g.getByRole('button', { name: 'PDF', exact: true }).click()]);
    return readFile((await d.path())!);
  };
  const antes = imagensNoPdf(await baixarPdf());
  await expect(g.getByTestId('rodape-logomarca')).toHaveCount(0);

  // Ajustes: escolher a imagem
  await g.goto('/configuracoes');
  const cartao = g.getByTestId('editar-logomarca');
  await expect(cartao).toContainText('Nenhuma logomarca ainda.');
  await cartao.getByLabel('Imagem da logomarca').setInputFiles(imagem);
  await expect(cartao).toContainText('Logomarca salva. Já aparece nos documentos, no termo e no rodapé.');
  await expect(g.getByTestId('previa-logomarca')).toBeVisible();
  // dá para baixar a imagem de volta
  const [baixada] = await Promise.all([g.waitForEvent('download'), cartao.getByRole('link', { name: 'Baixar a logomarca' }).click()]);
  expect(baixada.suggestedFilename()).toBe('logomarca.png');

  // rodapé das telas e o PDF com uma imagem a mais
  await expect(g.getByTestId('rodape-logomarca').locator('img')).toBeVisible();
  await g.goto('/');
  await expect(g.getByTestId('rodape-logomarca').locator('img')).toBeVisible();
  await g.goto('/relatorios');
  expect(imagensNoPdf(await baixarPdf())).toBe(antes + 1);

  // chegou ao servidor (vale para todos os aparelhos)
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(async () => String(((await lerDoServidor('parametro')).find((p) => p.chave === 'logomarca_instituicao')?.valor as { imagem?: string } | null)?.imagem ?? '')).toMatch(/^data:image\/png;base64,/);

  // sem login: entrada e catálogo público mostram a logomarca
  const pub = await browser.newContext();
  const p = await pub.newPage();
  await p.goto('/');
  await p.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await p.goto('/catalogo');
  await expect(p.getByTestId('rodape-logomarca').locator('img')).toBeVisible({ timeout: 15_000 });
  await p.goto('/');
  await expect(p.getByTestId('rodape-logomarca').locator('img')).toBeVisible();
  await pub.close();

  // tirar a logomarca: some do rodapé (e os outros testes seguem sem ela)
  await g.goto('/configuracoes');
  await cartao.getByRole('button', { name: 'Tirar a logomarca' }).click();
  await expect(cartao).toContainText('Nenhuma logomarca ainda.');
  await expect(g.getByTestId('rodape-logomarca')).toHaveCount(0);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  expect((await (await fetch(`${PB()}/api/crads/publico/logomarca`)).json()).logomarca).toBeNull();
  await ctx.close();
});
