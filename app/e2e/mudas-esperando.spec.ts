import { expect, test } from '@playwright/test';
import { somarMeses } from '../../dominio/src/index';
import { entrarComoViveirista, lerDoServidor, noCatalogo, PB } from './apoio';

test('mudas ainda não prontas: quem registra diz quando ficam prontas; o app não libera antes; no dia, entram sozinhas para doação', async ({ page }) => {
  const admin = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin, body: JSON.stringify(dados) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Esperia demonstrativa', familia: 'Testaceae', publicada: true });
  await criar('nome_popular', { especie_id: esp.id, nome: 'Árvore-que-espera', nome_busca: 'arvore que espera' });

  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto('/viveiro/estoque-inicial');
  await page.getByRole('button', { name: /Uma espécie por vez/ }).click();
  await page.getByLabel('Nome da espécie').fill('arvore que espera');
  await page.getByRole('button', { name: /Árvore-que-espera/ }).click();
  await page.getByLabel('Quantas mudas?').fill('25');
  await page.getByRole('button', { name: 'Ainda não' }).click();
  // sem dizer quando ficam prontas, não salva
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Diga quando as mudas ficam prontas para doação.');

  const hoje = new Date().toLocaleDateString('sv-SE');
  const dia = somarMeses(hoje, 3);
  const br = dia.split('-').reverse().join('/');
  await page.getByRole('button', { name: 'Daqui a 3 meses' }).click();
  await expect(page.getByTestId('quando-prontas')).toContainText(`Até ${br} as mudas ficam fora da doação. Nesse dia entram sozinhas para doação.`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('estoque-ok')).toContainText(`25 mudas de 1 espécie(s) cadastradas. Entram para doação sozinhas em ${br}.`);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });

  // no viveiro: ainda não está pronta, e o app mostra o dia
  const lote = (await lerDoServidor('lote_mudas')).find((l) => l.especie_id === esp.id)!;
  expect(lote).toMatchObject({ fase_atual: 'crescimento' });
  expect(String(lote.pronta_em).slice(0, 10)).toBe(dia);
  await page.goto('/viveiro');
  await expect(page.locator('.item-lista', { hasText: 'Árvore-que-espera' })).toContainText(`Pronta para doação em ${br} · 25 mudas`);
  await page.locator('.item-lista', { hasText: 'Árvore-que-espera' }).click();
  await expect(page.getByTestId('pronta-em')).toHaveText(`em ${br} (sozinha, sem precisar fazer nada)`);
  expect(await noCatalogo('Árvore-que-espera')).toBe(0);

  // o servidor confere todo dia: na véspera nada muda; no dia, entra para doação
  const expirar = (d: string) => fetch(`${PB()}/api/crads/manutencao/expirar`, { method: 'POST', headers: admin, body: JSON.stringify({ hoje: d }) });
  await expirar(somarMeses(hoje, 2));
  expect(await noCatalogo('Árvore-que-espera')).toBe(0);
  await expirar(dia);
  expect(await noCatalogo('Árvore-que-espera')).toBe(25);
  await page.reload();
  await expect(page.getByTestId('resumo-lm')).toContainText('Pronta', { timeout: 20_000 });
  await expect(page.getByTestId('pronta-em')).toHaveCount(0);
});
