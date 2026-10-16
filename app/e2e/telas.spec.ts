/**
 * Passeio por todas as telas com cada perfil: nenhuma pode quebrar (erro de
 * JavaScript, tela em branco). Serve de revisão geral a cada mudança.
 */
import { expect, test, type Page } from '@playwright/test';
import { entrarComoColetor, entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor, PB } from './apoio';

const ESTATICAS = [
  '/', '/avisos', '/catalogo', '/coleta', '/coleta/nova', '/coleta/relatorio', '/coleta/rota',
  '/configuracoes', '/doacao', '/doacao/novo', '/equipe', '/especies', '/especies/importar', '/identificar', '/instalar', '/lixeira', '/matrizes', '/matrizes/nova',
  '/municipios', '/permissoes', '/pos-plantio', '/relatorios', '/relatorios/rastreio', '/transparencia', '/viveiro', '/viveiro-atual', '/viveiro/estoque-inicial',
  '/viveiro/inventario', '/viveiro/semeadura', '/viveiros',
];

async function comIds(): Promise<string[]> {
  const um = async (col: string) => (await lerDoServidor(col)).find((r) => !r.excluido) as { id: string; codigo?: string } | undefined;
  const [m, ls, lm, d, e, p] = await Promise.all(['matriz', 'lote_sementes', 'lote_mudas', 'doacao', 'especie', 'plantio'].map(um));
  return [
    m && `/matrizes/${m.id}`,
    ls && `/coleta/lotes/${ls.id}`,
    lm && `/viveiro/lotes/${lm.id}`,
    lm && `/rastreio/${lm.codigo}`,
    d && `/doacao/${d.id}`,
    d && `/doacao/${d.id}/retirada`,
    d && `/pos-plantio/novo/${d.id}`,
    e && `/especies/${e.id}`,
    e && `/catalogo/${e.id}`,
    p && `/pos-plantio/${p.id}`,
    p && `/pos-plantio/${p.id}/acompanhamento`,
  ].filter(Boolean) as string[];
}

async function passear(page: Page, rotas: string[]) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(`${page.url()}: ${e.message}`));
  for (const rota of rotas) {
    await page.goto(rota);
    await page.waitForTimeout(400);
    const texto = (await page.locator('#raiz').innerText()).trim();
    expect(texto.length, `tela em branco: ${rota}`).toBeGreaterThan(10);
  }
  expect(erros, erros.join('\n')).toEqual([]);
}

const PERFIS = [
  ['gestora (administradora)', entrarComoGestora],
  ['viveirista', entrarComoViveirista],
  ['coletor', entrarComoColetor],
  ['solicitante', entrarComoSolicitante],
] as const;

for (const [nome, entrar] of PERFIS) {
  test(`todas as telas abrem sem erro: ${nome}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -10.18, longitude: -48.33 } });
    const page = await ctx.newPage();
    await entrar(page);
    await passear(page, [...ESTATICAS, ...(await comIds())]);
    await ctx.close();
  });
}

test('telas públicas abrem sem login', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  const lm = (await lerDoServidor('lote_mudas'))[0] as { codigo: string };
  await passear(page, ['/', '/catalogo', '/instalar', '/criar-conta', `/rastreio/${lm.codigo}`]);
});

test('quem não tem a permissão vê "Sem acesso" ao digitar o endereço', async ({ page }) => {
  await entrarComoSolicitante(page);
  for (const rota of ['/viveiro/semeadura', '/matrizes/nova', '/equipe', '/lixeira', '/relatorios']) {
    await page.goto(rota);
    await expect(page.getByTestId('sem-acesso'), rota).toBeVisible();
  }
  await page.goto('/configuracoes');
  await expect(page.getByRole('button', { name: /Preparar para ir a campo/ })).toHaveCount(0);
});

test('coletor não abre telas de viveiro nem de gestão', async ({ page }) => {
  await entrarComoColetor(page);
  for (const rota of ['/viveiro/semeadura', '/viveiro/estoque-inicial', '/equipe', '/lixeira', '/especies/nova', '/especies/importar']) {
    await page.goto(rota);
    await expect(page.getByTestId('sem-acesso'), rota).toBeVisible();
  }
  await page.goto('/matrizes/nova');
  await expect(page.getByTestId('sem-acesso')).toHaveCount(0);
});
