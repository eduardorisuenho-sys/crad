import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { escreverXlsx } from '../../dominio/src/index';
import { abrirModulo, entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor, noCatalogo, PB } from './apoio';

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

test('mudas que já estavam no viveiro ficam disponíveis para doação (gestor libera a espécie com um toque)', async ({ browser }) => {
  test.setTimeout(120_000);
  // espécie de teste ainda fora do catálogo (como as importadas da planilha)
  const admin = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin, body: JSON.stringify(dados) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Estoquia demonstrativa', familia: 'Testaceae', publicada: false });
  await criar('nome_popular', { especie_id: esp.id, nome: 'Árvore-do-estoque', nome_busca: 'arvore do estoque' });

  // 1) viveirista cadastra 40 mudas prontas; o app avisa que ainda não aparecem para doação
  const cv = await browser.newContext();
  const v = await cv.newPage();
  await entrarComoViveirista(v);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await v.goto('/viveiro/estoque-inicial');
  await v.getByRole('button', { name: /Uma espécie por vez/ }).click();
  await v.getByLabel('Nome da espécie').fill('arvore do estoque');
  await v.getByRole('button', { name: /Árvore-do-estoque/ }).click();
  await v.getByLabel('Quantas mudas?').fill('40');
  await v.getByRole('button', { name: 'Salvar' }).click();
  await expect(v.getByTestId('fora-do-catalogo')).toContainText('Árvore-do-estoque');
  await expect(v.getByTestId('fora-do-catalogo')).toContainText('Peça ao gestor');
  await expect.poll(async () => (await lerDoServidor('lote_mudas')).some((l) => l.especie_id === esp.id), { timeout: 20_000 }).toBe(true);
  expect(await noCatalogo('Árvore-do-estoque')).toBe(0);
  await cv.close();

  // 2) gestora vê o aviso em Doação e libera
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.goto('/doacao');
  await expect(g.getByTestId('fora-do-catalogo')).toContainText('40 mudas prontas');
  await g.getByRole('button', { name: 'Liberar para doação' }).click();
  await expect(g.getByTestId('liberadas')).toBeVisible();
  await expect.poll(() => noCatalogo('Árvore-do-estoque'), { timeout: 20_000 }).toBe(40);

  // 3) solicitante pede e a gestora aprova: a reserva sai do lote do estoque inicial
  const cs = await browser.newContext();
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await s.goto('/doacao/novo');
  await s.getByLabel('Quantidade de Árvore-do-estoque').fill('10');
  await s.getByRole('button', { name: 'Continuar (10 mudas)' }).click();
  await s.getByRole('button', { name: 'Escola ou quintal' }).click();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByLabel('CPF').fill('000.000.000-00');
  await s.getByLabel('Telefone').fill('63 90000-0004');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(s.getByText('Pedido registrado')).toBeVisible();
  await expect.poll(async () => (await s.getByRole('heading', { level: 1 }).innerText()).trim(), { timeout: 20_000 }).toMatch(/^Pedido DO-\d{4}-\d{3}$/);
  const codigo = (await s.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
  await expect.poll(async () => (await lerDoServidor('doacao')).some((d) => d.codigo === codigo), { timeout: 20_000 }).toBe(true);
  await cs.close();

  await g.reload();
  await expect(g.locator('.item-lista', { hasText: codigo })).toBeVisible({ timeout: 20_000 });
  await g.locator('.item-lista', { hasText: codigo }).click();
  await g.getByRole('button', { name: 'Analisar pedido' }).click();
  await g.getByLabel('Aprovar de Árvore-do-estoque').fill('10');
  await g.getByRole('button', { name: 'Aprovar e reservar' }).click();
  await expect(g.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  await expect.poll(() => noCatalogo('Árvore-do-estoque'), { timeout: 20_000 }).toBe(30);
  const lotes = (await lerDoServidor('lote_mudas')).filter((l) => l.especie_id === esp.id);
  expect(lotes).toEqual([expect.objectContaining({ origem: 'estoque_inicial' })]);
  const reservas = (await lerDoServidor('reserva')).filter((r) => r.lote_mudas_id === lotes[0].id);
  expect(reservas).toEqual([expect.objectContaining({ quantidade: 10, situacao: 'ativa' })]);
  await cg.close();
});
