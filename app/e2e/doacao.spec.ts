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
  await s.getByLabel('Endereço ou como chegar').fill('Sítio Boa Vista');
  await s.getByLabel('Área aproximada (hectares)').fill('0,5');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByLabel(/Instituição/).fill('particular');
  await s.getByLabel('CPF').fill('529.982.247-25');
  await s.getByLabel('Telefone').fill('63 90000-0003');
  await expect(s.getByText(/Ofício/)).toHaveCount(0); // não precisa anexar ofício
  // todos os campos são obrigatórios: CPF errado não passa
  await s.getByLabel('CPF').fill('111.111.111-11');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await expect(s.getByTestId('faltas')).toContainText('CPF incompleto ou com número errado.');
  await s.getByLabel('CPF').fill('529.982.247-25');
  await s.getByRole('button', { name: 'Continuar' }).click();
  // termo de compromisso: sem aceitar, não envia; o texto vem preenchido com o pedido
  const termo = s.getByTestId('termo');
  await expect(s.getByRole('button', { name: 'Enviar pedido' })).toBeDisabled();
  await termo.getByRole('button', { name: 'Ler o termo' }).click();
  const texto = termo.getByTestId('texto-termo');
  await expect(texto).toContainText('TERMO DE COMPROMISSO E DECLARAÇÃO');
  await expect(texto).toContainText('Eu, Solicitante Teste, declaro');
  await expect(texto).toContainText(`(${ESPECIE}: 30; total 30 mudas)`);
  await expect(texto).toContainText('NATURATINS');
  if (process.env.CRADS_FOTO_TERMO) await s.screenshot({ path: process.env.CRADS_FOTO_TERMO, fullPage: true });
  await termo.getByLabel('Li e aceito o termo de compromisso e declaração').check();
  await s.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(s.getByText('Pedido registrado')).toBeVisible();
  // em destaque: enviar o ofício à SEMARH com a solicitação em anexo
  const oficio = s.getByTestId('aviso-oficio');
  await expect(oficio).toContainText('Próximo passo: envie o ofício à SEMARH');
  await expect(oficio.getByRole('link', { name: 'protocolo@semarh.to.gov.br' })).toHaveAttribute('href', /^mailto:protocolo@semarh\.to\.gov\.br\?subject=Solicita/);
  // o próprio app gera a solicitação em PDF
  const pdfSolicitacao = s.waitForEvent('download');
  await s.getByRole('button', { name: 'Baixar a solicitação em PDF' }).click();
  expect((await pdfSolicitacao).suggestedFilename()).toMatch(/^solicitacao-DO-.*\.pdf$/);
  await expect(s.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  const codigo = (await s.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
  // o termo aceito fica no pedido e no servidor
  await expect(s.getByTestId('termo-aceito')).toContainText('Termo de compromisso aceito em');
  await expect.poll(async () => String((await lerDoServidor('doacao')).find((d) => d.codigo === codigo)?.termo_texto ?? ''), { timeout: 20_000 }).toContain(`${ESPECIE}: 30`);
  expect(codigo).toMatch(/^DO-\d{4}-\d{3}$/);
  // enquanto aguarda análise, o aviso continua na ficha do pedido
  await s.goto(s.url().split('?')[0]);
  await expect(s.getByTestId('aviso-oficio')).toBeVisible();
  await cs.close();

  // ---- 2. gestora marca no Plantando Água e aprova em parte (com internet)
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  // tela inicial: número vermelho de pendências no botão "Doação de mudas"
  await g.goto('/');
  await expect(g.getByTestId('pendencias-doacao')).toHaveText(/^\d+\+?$/);
  // leitor de tela ouve o número no nome do botão; o total vai no título (e no ícone do app, onde houver)
  await expect(g.locator('.grade-blocos').getByRole('link', { name: /^Doação de mudas, \d+ pendências?$/ })).toBeVisible();
  await expect(g).toHaveTitle(/^\(\d+\+?\) CRAD$/);
  if (process.env.CRADS_FOTO_PENDENCIAS) await g.locator('.grade-blocos').screenshot({ path: process.env.CRADS_FOTO_PENDENCIAS });
  await g.goto('/doacao');
  // na lista, o pedido que espera a gestora vem marcado
  await expect(g.locator('.item-lista', { hasText: codigo }).getByTestId('precisa-de-voce')).toBeVisible();
  await g.locator('.item-lista', { hasText: codigo }).click();
  await g.getByTestId('plantando-agua').click();
  await expect(g.getByTestId('plantando-agua')).toHaveAttribute('aria-pressed', 'true');
  await g.getByRole('button', { name: 'Analisar pedido' }).click();
  await g.getByLabel(`Aprovar de ${ESPECIE}`).fill('25');
  await g.getByRole('button', { name: 'Aprovar e reservar' }).click();
  await expect(g.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  await expect(g.getByTestId('resumo-pedido')).toContainText('aprovado em parte');
  // aprovado: o aviso do ofício sai da ficha
  await expect(g.getByTestId('aviso-oficio')).toHaveCount(0);
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
  await v.getByRole('link', { name: 'As mudas saíram (dar baixa)' }).click();
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
  await v.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(v.getByText(/aprovadas 25 mudas.*não dá para entregar 30/)).toBeVisible();
  await v.getByLabel(`Entregues de ${ESPECIE}`).fill('20');
  const download = v.waitForEvent('download');
  await v.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
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

test('o administrador muda o texto do termo e os próximos pedidos usam o novo', async ({ browser }) => {
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await g.goto('/configuracoes');
  const editar = g.getByTestId('editar-termo');
  await editar.getByText('Termo de compromisso dos pedidos').click();
  await expect(editar.getByLabel('Texto do termo')).toHaveValue(/^TERMO DE COMPROMISSO E DECLARAÇÃO/);
  await editar.getByLabel('Texto do termo').fill('TERMO DO CRAD\n\nEu, [NOME], vou plantar [ESPÉCIES E QUANTITATIVO].');
  await editar.getByRole('button', { name: 'Salvar termo' }).click();
  await expect(editar).toContainText('Termo salvo');
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(async () => String((await lerDoServidor('parametro')).find((p) => p.chave === 'termo_compromisso')?.valor ?? ''), { timeout: 20_000 }).toMatch(/^TERMO DO CRAD/);

  // quem pede vê o termo novo, já preenchido
  const cs = await browser.newContext();
  const s = await cs.newPage();
  await entrarComoSolicitante(s);
  await s.goto('/doacao/novo');
  await s.getByLabel(`Quantidade de ${ESPECIE}`).fill('2');
  await s.getByRole('button', { name: /Continuar/ }).click();
  await s.getByRole('button', { name: 'Escola ou quintal' }).click();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByLabel('Endereço ou como chegar').fill('Sítio Boa Vista');
  await s.getByLabel('Área aproximada (hectares)').fill('0,5');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByLabel(/Instituição/).fill('particular');
  await s.getByLabel('CPF').fill('529.982.247-25');
  await s.getByLabel('Telefone').fill('63 90000-0003');
  await s.getByRole('button', { name: 'Continuar' }).click();
  await s.getByTestId('termo').getByRole('button', { name: 'Ler o termo' }).click();
  await expect(s.getByTestId('texto-termo')).toHaveText(`TERMO DO CRAD\n\nEu, Solicitante Teste, vou plantar ${ESPECIE}: 2; total 2 mudas.`);
  await cs.close();

  // volta ao texto original (os outros testes usam o original)
  await editar.getByRole('button', { name: 'Voltar ao texto original' }).click();
  await expect(editar.getByLabel('Texto do termo')).toHaveValue(/^TERMO DE COMPROMISSO E DECLARAÇÃO/);
  await expect(g.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(async () => String((await lerDoServidor('parametro')).find((p) => p.chave === 'termo_compromisso')?.valor ?? ''), { timeout: 20_000 }).toMatch(/^TERMO DE COMPROMISSO/);
  await cg.close();
});
