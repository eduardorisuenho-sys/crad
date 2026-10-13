import { expect, test } from '@playwright/test';
import { abrirModulo, entrarComoGestora, entrarComoSolicitante, entrarComoViveirista, lerDoServidor, noCatalogo } from './apoio';

const ESPECIE = 'Árvore-da-doação';

test('pedido do solicitante, Plantando Água, aprovação com reserva e retirada sem internet com assinatura e termo', async ({ browser }) => {
  // ---- 1. solicitante pede mudas
  const cs = await browser.newContext({ acceptDownloads: true });
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await abrirModulo(s, 'Doação de mudas');
  await s.getByRole('link', { name: 'Pedir mudas' }).click();
  // um viveiro só no catálogo: vai direto para as mudas
  await s.getByLabel(`Quantidade de ${ESPECIE}`).fill('200');
  await s.getByRole('button', { name: /Continuar/ }).click();
  await expect(s.getByText(`Há 100 mudas de ${ESPECIE} disponíveis.`)).toBeVisible();
  await s.getByLabel(`Quantidade de ${ESPECIE}`).fill('30');
  await s.getByRole('button', { name: 'Continuar (30 mudas)' }).click();
  await s.getByRole('button', { name: 'Beira de rio ou nascente' }).click();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByLabel('CPF').fill('000.000.000-00');
  await s.getByLabel('Telefone').fill('63 90000-0003');
  await expect(s.getByText(/Ofício/)).toHaveCount(0); // não precisa anexar ofício
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(s.getByText('Pedido registrado')).toBeVisible();
  // o próprio app gera a solicitação em PDF
  const pdfSolicitacao = s.waitForEvent('download');
  await s.getByRole('button', { name: 'Baixar a solicitação em PDF' }).click();
  expect((await pdfSolicitacao).suggestedFilename()).toMatch(/^solicitacao-DO-.*\.pdf$/);
  await expect(s.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  const codigo = (await s.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
  expect(codigo).toMatch(/^DO-\d{4}-\d{3}$/);
  await cs.close();

  // ---- 2. gestora marca no Plantando Água e aprova em parte (com internet)
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await g.goto('/doacao');
  await g.locator('.item-lista', { hasText: codigo }).click();
  await g.getByTestId('plantando-agua').click();
  await expect(g.getByTestId('plantando-agua')).toHaveAttribute('aria-pressed', 'true');
  await g.getByRole('button', { name: 'Analisar pedido' }).click();
  await g.getByLabel(`Aprovar de ${ESPECIE}`).fill('25');
  await g.getByRole('button', { name: 'Aprovar e reservar' }).click();
  await expect(g.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  await expect(g.getByTestId('resumo-pedido')).toContainText('aprovado em parte');
  expect(await noCatalogo(ESPECIE)).toBe(75);
  await cg.close();

  // ---- 3. viveirista registra a retirada sem internet
  const cv = await browser.newContext({ acceptDownloads: true });
  const v = await cv.newPage();
  await entrarComoViveirista(v);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await cv.setOffline(true);
  await v.goto('/doacao');
  await v.getByRole('button', { name: 'Aguardando retirada' }).click();
  await v.locator('.item-lista', { hasText: codigo }).click();
  await expect(v.getByTestId('plantando-agua')).toHaveAttribute('aria-pressed', 'true');
  await v.getByRole('link', { name: 'Registrar retirada' }).click();
  await v.getByLabel(`Entregues de ${ESPECIE}`).fill('30');
  await v.getByLabel('Nome').fill('Recebedor Teste');
  // assina com o "dedo"
  const tela = v.getByLabel('Área para assinar');
  const caixa = (await tela.boundingBox())!;
  const toque = (tipo: string, x: number, y: number) =>
    tela.dispatchEvent(tipo, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: caixa.x + x, clientY: caixa.y + y });
  await toque('pointerdown', 20, 100);
  for (const [x, y] of [[60, 70], [120, 40], [170, 90], [220, 120]]) await toque('pointermove', x, y);
  await toque('pointerup', 220, 120);
  await expect(v.getByText('Assinado')).toBeVisible();
  await v.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(v.getByText(/reservadas 25 mudas.*não dá para entregar 30/)).toBeVisible();
  await v.getByLabel(`Entregues de ${ESPECIE}`).fill('20');
  const download = v.waitForEvent('download');
  await v.getByRole('button', { name: 'Confirmar retirada' }).click();
  expect((await download).suggestedFilename()).toBe(`termo-${codigo}.pdf`);
  if (process.env.CRADS_SALVAR_TERMO) await (await download).saveAs(process.env.CRADS_SALVAR_TERMO);
  await expect(v.getByTestId('resumo-pedido')).toContainText('retirado');
  await expect(v.getByTestId('itens-pedido')).toContainText('20');

  await cv.setOffline(false);
  await expect(v.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const [doacao] = (await lerDoServidor('doacao')).filter((d) => d.codigo === codigo);
  expect(doacao.situacao).toBe('retirada');
  const saidas = (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.referencia === codigo);
  expect(saidas).toEqual([expect.objectContaining({ tipo: 'saida_doacao', quantidade: 20 })]);
  const [ret] = (await lerDoServidor('retirada')).filter((r) => r.doacao_id === doacao.id);
  expect(ret).toMatchObject({ recebedor_nome: 'Recebedor Teste' });
  expect(String(ret.assinatura)).toMatch(/\.png$/);
  expect(String(ret.termo_pdf)).toMatch(/\.pdf$/);
  const hist = (await lerDoServidor('doacao_programa_historico')).filter((h) => h.doacao_id === doacao.id);
  expect(hist).toEqual([expect.objectContaining({ acao: 'marcou', usuario_nome: 'Gestora Teste' })]);
  // 100 − 20 entregues; as 5 reservadas e não levadas voltam ao catálogo
  expect(await noCatalogo(ESPECIE)).toBe(80);
  await cv.close();
});
