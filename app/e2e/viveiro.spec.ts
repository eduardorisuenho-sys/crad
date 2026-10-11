import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoViveirista, lerDoServidor } from './apoio';

test('viveirista semeia, conta germinação, registra perda, muda de fase e faz inventário sem internet', async ({ page, context }) => {
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await context.setOffline(true);

  // Um lote de sementes próprio deste teste (formado no aparelho, sem internet)
  await page.goto('/coleta/nova?matriz=' + (await page.evaluate(async () => {
    const req = indexedDB.open('crads');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const tx = db.transaction('matriz');
    const todas: { id: string; codigo: string }[] = await new Promise((ok) => {
      const r = tx.objectStore('matriz').getAll();
      r.onsuccess = () => ok(r.result);
    });
    return todas.find((m) => m.codigo === 'MT-9001')!.id;
  })));
  await page.getByLabel('Quantidade').fill('1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Sementes' }).click();
  await page.getByRole('button', { name: 'Pular a foto' }).click();
  await page.getByRole('button', { name: 'Salvar coleta' }).click();
  await page.goto('/coleta/lotes/novo');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  // marca só a coleta deste teste (a mais recente, de 1 kg)
  for (const cb of await page.locator('.candidata input').all()) await cb.uncheck();
  await page.locator('.candidata', { hasText: '1 kg' }).locator('input').check();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByLabel('Peso das sementes limpas (gramas)').fill('500');
  await page.getByLabel('Número de sementes (estimado, opcional)').fill('1000');
  await page.getByRole('button', { name: 'Criar lote' }).click();

  // Semeadura: 200 sementes em tubete
  await page.getByRole('link', { name: 'Semear deste lote' }).click();
  await page.getByLabel('Número de sementes').fill('200');
  await page.getByLabel('Peso (gramas)').fill('100');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Tubete' }).click();
  await page.getByLabel('Canteiro (opcional)').fill('C3');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar lote de mudas' }).click();
  const codigo = (await page.getByTestId('etiqueta-lm').locator('.codigo-grande').innerText()).trim();
  // Sem internet e sem faixa reservada, o LS é provisório; então o LM também é.
  expect(codigo).toMatch(/^LM-P-[A-Z0-9]+-\d+$/);

  // Germinação: 120 e depois 150 (acumulado) → taxa 75%
  const registrar = async (acao: string) => page.getByRole('button', { name: acao, exact: true }).click();
  await registrar('Contar germinação');
  await page.getByLabel('Total de plântulas nascidas até hoje').fill('120');
  await registrar('Registrar');
  await registrar('Contar germinação');
  await page.getByLabel('Total de plântulas nascidas até hoje').fill('150');
  await registrar('Registrar');
  await expect(page.getByTestId('germinacao')).toHaveText('150 de 200 (75%)');
  await expect(page.getByTestId('saldo-mudas')).toHaveText('150');
  // contagem menor que a anterior é recusada
  await registrar('Contar germinação');
  await page.getByLabel('Total de plântulas nascidas até hoje').fill('140');
  await registrar('Registrar');
  await expect(page.getByText(/anterior foi 150/)).toBeVisible();

  // Perda maior que o saldo é bloqueada; perda normal baixa o estoque
  await registrar('Perda');
  await page.getByLabel('Quantas mudas morreram ou foram descartadas').fill('200');
  await registrar('Registrar');
  await expect(page.getByText('O lote tem 150 mudas.')).toBeVisible();
  await page.getByLabel('Quantas mudas morreram ou foram descartadas').fill('10');
  await page.getByRole('button', { name: 'Praga ou formiga' }).click();
  await registrar('Registrar');
  await expect(page.getByTestId('saldo-mudas')).toHaveText('140');

  // Fase: só avança
  await registrar('Mudar de fase');
  await page.getByRole('button', { name: 'Rustificação' }).click();
  await registrar('Registrar');
  await expect(page.getByTestId('resumo-lm')).toContainText('Rustificação');
  await registrar('Mudar de fase');
  await expect(page.locator('.cartao', { hasText: 'Registrar' }).getByRole('button', { name: 'Crescimento' })).toHaveCount(0);

  // Inventário: contou 137 → ajuste de −3
  await page.goto('/');
  await abrirModulo(page, 'Viveiro');
  await page.getByRole('link', { name: 'Inventário' }).click();
  await page.getByLabel(`Contado em ${codigo}`).fill('137');
  await expect(page.getByText('diferença: -3')).toBeVisible();
  await page.getByRole('button', { name: /Fechar inventário/ }).click();
  await expect(page.getByText(/Inventário fechado: 1 lote\(s\) contado\(s\), 1 ajuste/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const [lm] = (await lerDoServidor('lote_mudas')).filter((l) => l.sementes_semeadas === 200);
  expect(lm).toMatchObject({ fase_atual: 'rustificacao', recipiente: 'tubete', canteiro: 'C3' });
  // No servidor, o LM ganha o código definitivo derivado do LS definitivo.
  const ls = (await lerDoServidor('lote_sementes')).find((l) => l.id === lm.lote_sementes_id)!;
  expect(String(ls.codigo)).toMatch(/^LS-\d{4}-\d{3}$/);
  expect(lm.codigo).toBe(`${String(ls.codigo).replace('LS-', 'LM-')}-A`);
  const movs = (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.lote_mudas_id === lm.id);
  expect(movs.reduce((s, m) => s + (m.tipo === 'entrada' ? Number(m.quantidade) : m.tipo === 'ajuste_inventario' ? Number(m.quantidade) : -Number(m.quantidade)), 0)).toBe(137);
  const sem = (await lerDoServidor('movimento_sementes')).filter((m) => m.tipo === 'semeadura' && m.lote_mudas_id === lm.id);
  expect(sem).toEqual([expect.objectContaining({ quantidade_g: 100, quantidade_unid: 200 })]);
});
