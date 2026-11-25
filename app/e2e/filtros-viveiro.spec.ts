/**
 * Filtros por viveiro: com mais de um viveiro, o que se escolhe mostra só o que
 * é daquele viveiro (catálogo, aviso de mudas fora do catálogo, lista do viveiro
 * e relatórios).
 */
import { expect, test } from '@playwright/test';
import { somarMeses } from '../../dominio/src/index';
import { abrirModulo, entrarComoGestora, PB } from './apoio';

const V1 = 'vivteste0000001'; // "Viveiro Teste"
const V2 = 'vivfiltro000002';
const admin = () => ({ authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' });
const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin(), body: JSON.stringify(dados) })).json()) as { id: string };
const apagar = (col: string, id: string) => fetch(`${PB()}/api/collections/${col}/records/${id}`, { method: 'PATCH', headers: admin(), body: JSON.stringify({ excluido: true }) });
const criados: [string, string][] = [];
const prontaEm = somarMeses(new Date().toLocaleDateString('sv-SE'), 2);

async function lote(codigo: string, especie: string, viveiro: string, quantidade: number, extra: object = {}) {
  const l = await criar('lote_mudas', { codigo, origem: 'estoque_inicial', especie_id: especie, fase_atual: 'pronta', situacao: 'ativo', viveiro_id: viveiro, versao: 1, ...extra });
  const m = await criar('movimento_estoque_mudas', { lote_mudas_id: l.id, tipo: 'entrada', quantidade, data: '2026-11-01', viveiro_id: viveiro, versao: 1 });
  criados.push(['lote_mudas', l.id], ['movimento_estoque_mudas', m.id]);
}

test.beforeAll(async () => {
  await criar('viveiro', { id: V2, sigla: 'FIL', nome: 'Viveiro Filtro', ativo: true });
  const especie = async (nome: string) => {
    const e = await criar('especie', { nome_cientifico: `Filtria ${nome.toLowerCase()}`, familia: 'Testaceae', publicada: true });
    await criar('nome_popular', { especie_id: e.id, nome, nome_busca: nome.toLowerCase() });
    return e.id;
  };
  const deUm = await especie('Árvore-só-do-um');
  const deDois = await especie('Árvore-só-do-dois');
  const dasDuas = await especie('Árvore-dos-dois-viveiros');
  const crescendoUm = await especie('Árvore-crescendo-no-um');
  const esperaDois = await especie('Árvore-esperando-no-dois');
  await lote('LM-2026-I-801', deUm, V1, 30);
  await lote('LM-2026-I-802', deDois, V2, 20);
  await lote('LM-2026-I-803', dasDuas, V1, 5);
  await lote('LM-2026-I-804', dasDuas, V2, 7);
  await lote('LM-2026-I-805', crescendoUm, V1, 11, { fase_atual: 'crescimento' });
  await lote('LM-2026-I-806', esperaDois, V2, 13, { fase_atual: 'crescimento', pronta_em: prontaEm });
});

// os outros testes contam com um viveiro só no catálogo
test.afterAll(async () => {
  for (const [col, id] of criados) await apagar(col, id);
  await fetch(`${PB()}/api/collections/viveiro/records/${V2}`, { method: 'PATCH', headers: admin(), body: JSON.stringify({ excluido: true, ativo: false }) });
});

test('catálogo: cada viveiro mostra só as mudas dele, e o aviso de mudas fora do catálogo também', async ({ page }) => {
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await page.goto('/catalogo');
  const cartao = (nome: string) => page.locator('.cartao-especie', { hasText: nome });
  const aviso = page.getByTestId('diagnostico-catalogo');

  // todos os viveiros: soma
  await expect(cartao('Árvore-dos-dois-viveiros')).toContainText('12 mudas');
  await expect(aviso).toContainText('LM-2026-I-805');
  await expect(aviso).toContainText('LM-2026-I-806');

  await page.getByRole('button', { name: 'Viveiro Filtro', exact: true }).click();
  await expect(cartao('Árvore-só-do-dois')).toContainText('20 mudas');
  await expect(cartao('Árvore-dos-dois-viveiros')).toContainText('7 mudas');
  await expect(cartao('Árvore-só-do-um')).toHaveCount(0);
  // aviso: só o lote deste viveiro, com o dia em que entra sozinho para doação
  await expect(aviso).not.toContainText('LM-2026-I-805');
  await expect(aviso.locator('.item-lista', { hasText: 'LM-2026-I-806' })).toContainText(`Entra para doação sozinha em ${prontaEm.split('-').reverse().join('/')}.`);

  await page.getByRole('button', { name: 'Viveiro Teste', exact: true }).click();
  await expect(cartao('Árvore-só-do-um')).toContainText('30 mudas');
  await expect(cartao('Árvore-dos-dois-viveiros')).toContainText('5 mudas');
  await expect(cartao('Árvore-só-do-dois')).toHaveCount(0);
  await expect(aviso).toContainText('LM-2026-I-805');
  await expect(aviso).not.toContainText('LM-2026-I-806');
});

test('lista do viveiro e relatórios seguem o viveiro escolhido', async ({ page }) => {
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });

  // viveiro atual: Viveiro Filtro
  await page.goto('/viveiro-atual');
  await page.getByRole('button', { name: 'Viveiro Filtro' }).click();
  // a escolha fica guardada e o app volta ao início: só então abre o viveiro
  await expect(page).toHaveURL(/\/$/);
  await abrirModulo(page, 'Viveiro');
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-802' })).toBeVisible();
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-806' })).toBeVisible();
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-801' })).toHaveCount(0);
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-805' })).toHaveCount(0);

  // de volta ao Viveiro Teste
  await page.goto('/viveiro-atual');
  await page.getByRole('button', { name: 'Viveiro Teste' }).click();
  // a escolha fica guardada e o app volta ao início: só então abre o viveiro
  await expect(page).toHaveURL(/\/$/);
  await abrirModulo(page, 'Viveiro');
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-801' })).toBeVisible();
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-802' })).toHaveCount(0);

  // relatórios: o filtro de viveiro conta só as mudas dele
  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Tudo', exact: true }).click();
  await page.getByRole('button', { name: 'Viveiro Filtro', exact: true }).click();
  await expect(page.getByTestId('recorte')).toHaveText('Tudo · Viveiro Filtro');
  await expect(page.getByTestId('indicadores').locator('li', { hasText: 'Mudas prontas' }).locator('strong')).toHaveText('27');
});
