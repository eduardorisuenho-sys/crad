/** Botão "Editar" nas matrizes, coletas e lotes de sementes (funciona sem internet). */
import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

test('editar matriz, coleta e lote de sementes, sem internet', async ({ page, context }) => {
  const h = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: h, body: JSON.stringify({ versao: 1, viveiro_id: 'vivteste0000001', ...dados }) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Editaria demonstrativa' });
  await criar('nome_popular', { especie_id: esp.id, nome: 'Árvore-para-editar', nome_busca: 'arvore para editar' });
  const m = await criar('matriz', { codigo: `MT-9${Math.floor(Math.random() * 90000) + 10000}`, especie_id: esp.id, grau_certeza: 'provavel', lat: -10.2, lon: -48.3, altura_m: 10, situacao: 'ativa' });
  const c = await criar('coleta', { especie_id: esp.id, data: '2026-10-01', quantidade: 2, unidade: 'kg', material: 'semente' });
  // o servidor cria sozinho o lote de sementes da coleta

  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await context.setOffline(true);

  // matriz: altura, certeza, situação e ponto do GPS
  await page.goto(`/matrizes/${m.id}`);
  await page.getByRole('button', { name: 'Editar a matriz' }).click();
  const f = page.getByTestId('editar-registro');
  await f.getByLabel('Altura (m)').fill('12,5');
  await f.getByLabel('Certeza da espécie').selectOption({ label: 'certo' });
  await f.getByLabel('Latitude').fill('99');
  await f.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(f.getByText('Latitude fora do Brasil.')).toBeVisible();
  await f.getByLabel('Latitude').fill('-10,25');
  await f.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();

  // coleta: pela lista de coletas, abre a ficha e edita
  await page.goto(`/coleta/${c.id}`);
  await expect(page.getByTestId('ficha-coleta')).toContainText('2 quilos (kg) de sementes');
  await page.getByRole('button', { name: 'Editar a coleta' }).click();
  await page.getByTestId('editar-registro').getByLabel('Quantidade').fill('7');
  await page.getByTestId('editar-registro').getByLabel('Observação').fill('pesado de novo');
  await expect(page.getByText('corrija também o peso na ficha do lote')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByTestId('ficha-coleta')).toContainText('7 quilos (kg) de sementes');
  await expect(page.getByTestId('ficha-coleta')).toContainText('pesado de novo');

  // lote de sementes: validade e número de sementes
  await page.getByRole('link', { name: 'Abrir o lote de sementes' }).click();
  await expect(page).toHaveURL(/\/coleta\/lotes\/\w+$/);
  const ls = { id: page.url().split('/').pop()! };
  await page.getByRole('button', { name: 'Editar o lote de sementes' }).click();
  await page.getByTestId('editar-registro').getByLabel('Validade').fill('2027-10-01');
  await page.getByTestId('editar-registro').getByLabel('Número de sementes (estimado)').fill('1500');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();

  // volta a internet: tudo chega ao servidor
  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(async () => (await lerDoServidor('matriz')).find((x) => x.id === m.id), { timeout: 20_000 }).toMatchObject({ altura_m: 12.5, grau_certeza: 'certo', lat: -10.25, lon: -48.3 });
  await expect.poll(async () => (await lerDoServidor('coleta')).find((x) => x.id === c.id), { timeout: 20_000 }).toMatchObject({ quantidade: 7, observacao: 'pesado de novo' });
  await expect.poll(async () => (await lerDoServidor('lote_sementes')).find((x) => x.id === ls.id), { timeout: 20_000 }).toMatchObject({ sementes_estimadas: 1500, validade: expect.stringMatching(/^2027-10-01/) });
  // nada foi recusado pelo servidor
  await expect(page.getByTestId('barra-sync')).not.toContainText('aviso');
});
