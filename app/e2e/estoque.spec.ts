import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { escreverXlsx } from '../../dominio/src/index';
import { abrirModulo, entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor, noCatalogo, PB } from './apoio';

test('viveirista cadastra sem internet as mudas que já estavam no viveiro: uma espécie, lista e planilha', async ({ page, context }) => {
  await entrarComoViveirista(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await context.setOffline(true);
  await abrirModulo(page, 'Viveiro');
  await page.getByRole('link', { name: /Registrar mudas/ }).click();

  // 1) uma espécie por vez
  await page.getByRole('button', { name: /Uma espécie por vez/ }).click();
  await page.getByLabel('Nome da espécie').fill('campo ficticia');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await page.getByLabel('Quantas mudas?').fill('25');
  await expect(page.getByRole('group', { name: 'Fase' })).toHaveCount(0); // tudo entra pronto para doação
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
  writeFileSync(arquivo, escreverXlsx([{ nome: 'Estoque', linhas: [['Espécie', 'Quantidade'], ['Árvore-de-campo-fictícia', 15], ['Espécie que não existe', 3]] }]));
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
  expect(lotes.find((l) => l.canteiro === 'canteiro 9')?.fase_atual).toBe('pronta');

  await page.goto('/viveiro');
  await page.locator('.item-lista', { hasText: /LM-\d{4}-I-/ }).first().click();
  await expect(page.getByTestId('origem-lm')).toContainText('origem das sementes não registrada');
  await expect(page.getByTestId('germinacao')).toHaveCount(0);
});

test('mudas que já estavam no viveiro: foto, liberar para doação, limite por espécie, combinar a retirada e baixa no estoque', async ({ browser }) => {
  test.setTimeout(180_000);
  // espécie de teste ainda fora do catálogo (como as importadas da planilha)
  const admin = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin, body: JSON.stringify(dados) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Estoquia demonstrativa', familia: 'Testaceae', publicada: false });
  await criar('nome_popular', { especie_id: esp.id, nome: 'Árvore-do-estoque', nome_busca: 'arvore do estoque' });
  // telefone do viveiro (aparece para quem pediu, depois da aprovação)
  await fetch(`${PB()}/api/collections/viveiro/records/vivteste0000001`, { method: 'PATCH', headers: admin, body: JSON.stringify({ telefone: '(63) 3218-0000', endereco: 'Quadra Teste, Palmas' }) });

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
  await v.locator('label', { hasText: 'Tirar foto das mudas' }).locator('input').setInputFiles(fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url)));
  await expect(v.getByRole('img', { name: 'Foto das mudas' })).toBeVisible();
  await v.getByRole('button', { name: 'Salvar' }).click();
  await expect(v.getByTestId('fora-do-catalogo')).toContainText('Árvore-do-estoque');
  await expect(v.getByTestId('fora-do-catalogo')).toContainText('Peça ao gestor');
  await expect.poll(async () => (await lerDoServidor('lote_mudas')).some((l) => l.especie_id === esp.id), { timeout: 20_000 }).toBe(true);
  expect(await noCatalogo('Árvore-do-estoque')).toBe(0);

  // 2) gestora vê o aviso no Viveiro e libera
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.goto('/viveiro');
  await expect(g.getByTestId('fora-do-catalogo')).toContainText('40 mudas prontas');
  await g.getByRole('button', { name: 'Liberar para doação' }).click();
  await expect(g.getByTestId('liberadas')).toBeVisible();
  await expect.poll(() => noCatalogo('Árvore-do-estoque'), { timeout: 20_000 }).toBe(40);
  // a foto das mudas aparece no catálogo (rota pública, sem login)
  await expect
    .poll(async () => ((await (await fetch(`${PB()}/api/crads/publico/catalogo`)).json()).itens as { nomes_populares: string[]; foto?: { colecao?: string } }[]).find((i) => i.nomes_populares.includes('Árvore-do-estoque'))?.foto?.colecao, { timeout: 20_000 })
    .toBe('foto');
  const item = ((await (await fetch(`${PB()}/api/crads/publico/catalogo`)).json()).itens as { nomes_populares: string[]; foto: { id: string; arquivo: string } }[]).find((i) => i.nomes_populares.includes('Árvore-do-estoque'))!;
  const img = await fetch(`${PB()}/api/crads/publico/foto/${item.foto.id}/${item.foto.arquivo}`);
  expect(img.status).toBe(200);
  expect(img.headers.get('content-type')).toMatch(/image/);
  await g.goto('/catalogo');
  const figura = g.locator('.cartao-especie', { hasText: 'Árvore-do-estoque' }).locator('img');
  await figura.scrollIntoViewIfNeeded();
  await expect.poll(() => figura.evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);

  // 3) solicitante pede e a gestora aprova: a reserva sai do lote do estoque inicial
  const cs = await browser.newContext();
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await s.goto('/doacao/novo');
  // até 30 mudas de cada espécie (o total do pedido não tem limite)
  await s.getByLabel('Quantidade de Árvore-do-estoque').fill('31');
  await s.getByRole('button', { name: /Continuar/ }).click();
  await expect(s.getByText('Cada pedido pode ter até 30 mudas de Árvore-do-estoque.')).toBeVisible();
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

  await g.goto('/doacao');
  await expect(g.locator('.item-lista', { hasText: codigo })).toBeVisible({ timeout: 20_000 });
  // aviso com som para quem aprova: chegou um pedido novo (tocar abre o pedido)
  await expect(g.getByTestId('notificacoes')).toContainText('Novo pedido de mudas', { timeout: 20_000 });
  await expect(g.getByTestId('notificacoes')).toContainText(codigo);
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

  // 4) combinar a retirada: o viveiro vê o telefone de quem pediu e marca o dia
  const combinar = g.getByTestId('combinar-retirada');
  await combinar.getByRole('button', { name: 'Ver telefone de quem pediu' }).click();
  await expect(combinar.getByTestId('contato')).toContainText('63 90000-0004');
  await expect(combinar.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5563900000004');
  await combinar.getByLabel('Dia combinado').fill('2026-12-01');
  await combinar.getByLabel(/Observação/).fill('pela manhã');
  await combinar.getByRole('button', { name: 'Salvar dia combinado' }).click();
  await expect(combinar.getByTestId('dia-combinado')).toContainText('01/12/2026');
  const aud = await (await fetch(`${PB()}/api/collections/auditoria/records?perPage=500&filter=${encodeURIComponent("acao='ver_contato'")}`, { headers: admin })).json();
  expect(aud.items.length).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await lerDoServidor('doacao')).find((d) => d.codigo === codigo)?.retirada_combinada, { timeout: 20_000 }).toMatch(/^2026-12-01/);
  await cg.close();

  // quem pediu vê o dia combinado e o telefone do viveiro
  await s.reload();
  await expect(s.getByTestId('notificacoes')).toContainText('Seu pedido de mudas foi aprovado!', { timeout: 20_000 });
  await expect(s.getByTestId('dia-combinado')).toContainText('01/12/2026', { timeout: 20_000 });
  await expect(s.getByTestId('contato')).toContainText('(63) 3218-0000');
  await cs.close();

  // 5) retirada: as mudas entregues saem do estoque do lote (baixa)
  await v.goto('/doacao');
  await v.getByRole('button', { name: 'Aguardando retirada' }).click();
  await v.locator('.item-lista', { hasText: codigo }).click();
  await v.getByRole('link', { name: 'Registrar retirada' }).click();
  await v.getByLabel('Nome').fill('Recebedor Estoque');
  const tela = v.getByLabel('Área para assinar');
  const caixa = (await tela.boundingBox())!;
  const toque = (tipo: string, x: number, y: number) => tela.dispatchEvent(tipo, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: caixa.x + x, clientY: caixa.y + y });
  await toque('pointerdown', 20, 100);
  for (const [x, y] of [[80, 60], [160, 110], [220, 70]]) await toque('pointermove', x, y);
  await toque('pointerup', 220, 70);
  await v.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(v.getByTestId('resumo-pedido')).toContainText('retirado');
  await expect.poll(async () => (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.lote_mudas_id === lotes[0].id && m.tipo === 'saida_doacao').map((m) => m.quantidade), { timeout: 20_000 }).toEqual([10]);
  await v.goto('/viveiro');
  await expect(v.locator('.item-lista', { hasText: 'Árvore-do-estoque' })).toContainText('Pronta para doação · 30 mudas');
  expect(await noCatalogo('Árvore-do-estoque')).toBe(30);
  await cv.close();
});
