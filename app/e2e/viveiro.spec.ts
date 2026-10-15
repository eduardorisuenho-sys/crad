import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoViveirista, lerDoServidor } from './apoio';

test('viveirista semeia, conta germinação, registra perda, marca como pronta e faz inventário sem internet', async ({ page, context }) => {
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });

  // Um lote de sementes próprio deste teste: a coleta vira lote sozinha no servidor
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
  await expect(page.getByText('Coleta salva')).toBeVisible();
  const coletaDoTeste = async () => (await lerDoServidor('coleta')).find((c) => c.quantidade === 1 && c.unidade === 'kg' && c.material === 'semente');
  await expect.poll(async () => !!(await coletaDoTeste()), { timeout: 20_000 }).toBe(true);
  const coletaId = String((await coletaDoTeste())!.id);
  await expect.poll(async () => (await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === coletaId)?.lote_sementes_id, { timeout: 20_000 }).toBeTruthy();
  const loteId = String((await lerDoServidor('lote_sementes_coleta')).find((l) => l.coleta_id === coletaId)!.lote_sementes_id);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto(`/coleta/lotes/${loteId}`);
  await expect(page.getByTestId('saldo')).toHaveText('1000 g', { timeout: 20_000 });
  await context.setOffline(true);

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
  // O LS já veio definitivo do servidor; o LM herda o número dele.
  expect(codigo).toMatch(/^LM-\d{4}-\d{3}-A$/);

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

  // Sem fases intermediárias: em formação → pronta para doação
  await expect(page.getByTestId('resumo-lm')).toContainText('Em formação');
  await registrar('Marcar como pronta');
  await registrar('Registrar');
  await expect(page.getByTestId('resumo-lm')).toContainText('Pronta para doação');
  await expect(page.getByRole('button', { name: 'Marcar como pronta', exact: true })).toHaveCount(0);

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
  expect(lm).toMatchObject({ fase_atual: 'pronta', recipiente: 'tubete', canteiro: 'C3' });
  // No servidor, o LM ganha o código definitivo derivado do LS definitivo.
  const ls = (await lerDoServidor('lote_sementes')).find((l) => l.id === lm.lote_sementes_id)!;
  expect(String(ls.codigo)).toMatch(/^LS-\d{4}-\d{3}$/);
  expect(lm.codigo).toBe(`${String(ls.codigo).replace('LS-', 'LM-')}-A`);
  const movs = (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.lote_mudas_id === lm.id);
  expect(movs.reduce((s, m) => s + (m.tipo === 'entrada' ? Number(m.quantidade) : m.tipo === 'ajuste_inventario' ? Number(m.quantidade) : -Number(m.quantidade)), 0)).toBe(137);
  const sem = (await lerDoServidor('movimento_sementes')).filter((m) => m.tipo === 'semeadura' && m.lote_mudas_id === lm.id);
  expect(sem).toEqual([expect.objectContaining({ quantidade_g: 100, quantidade_unid: 200 })]);
});
