/** Pedido no balcão: a mesma pessoa da equipe registra, aprova e dá baixa no mesmo celular. */
import { expect, test } from '@playwright/test';
import { type Page } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, noCatalogo, PB } from './apoio';

async function assinar(page: Page) {
  const tela = page.getByLabel('Área para assinar');
  const caixa = (await tela.boundingBox())!;
  const toque = (tipo: string, x: number, y: number) => tela.dispatchEvent(tipo, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: caixa.x + x, clientY: caixa.y + y });
  await toque('pointerdown', 20, 100);
  for (const [x, y] of [[80, 60], [160, 110], [220, 70]]) await toque('pointermove', x, y);
  await toque('pointerup', 220, 70);
}
const admin = () => ({ authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' });

const ESPECIE = 'Árvore-do-balcão';

test('pedido no balcão: registrar, aprovar e dar baixa no mesmo aparelho', async ({ page }) => {
  // espécie só deste teste (os outros testes rodam ao mesmo tempo)
  const h = admin();
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: h, body: JSON.stringify(dados) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Balcaoia demonstrativa', familia: 'Testaceae' });
  await criar('nome_popular', { especie_id: esp.id, nome: ESPECIE, nome_busca: 'arvore do balcao' });
  const lote = await criar('lote_mudas', { codigo: 'LM-2026-I-901', especie_id: esp.id, fase_atual: 'pronta', origem: 'estoque_inicial', situacao: 'ativo', viveiro_id: 'vivteste0000001' });
  await criar('movimento_estoque_mudas', { lote_mudas_id: lote.id, tipo: 'entrada', quantidade: 10, data: '2026-03-01', viveiro_id: 'vivteste0000001' });
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  const antes = await noCatalogo(ESPECIE);
  await page.goto('/doacao/novo');
  await page.getByLabel(`Quantidade de ${ESPECIE}`).fill('1');
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: 'Reserva legal' }).click();
  await page.getByLabel('Município').fill('Palmas');
  await page.getByLabel('Endereço ou como chegar').fill('Sítio Boa Vista');
  await page.getByLabel('Área aproximada (hectares)').fill('0,5');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Instituição' }).click();
  await page.getByLabel('Nome completo').fill('Meliponativa');
  await page.getByLabel(/Instituição \(escola/).fill('Associação');
  await page.getByLabel('CNPJ').fill('11.222.333/0001-81');
  await page.getByLabel('Telefone').fill('63 90000-0010');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Li e aceito o termo de compromisso e declaração').check();
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.getByText('Pedido registrado')).toBeVisible();
  await expect.poll(async () => (await page.getByRole('heading', { level: 1 }).innerText()).trim(), { timeout: 20_000 }).toMatch(/^Pedido DO-\d{4}-\d{3}$/);
  const codigo = (await page.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Analisar pedido' }).click();
  await page.getByRole('button', { name: 'Aprovar e reservar' }).click();
  await expect(page.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  await expect.poll(() => noCatalogo(ESPECIE), { timeout: 20_000 }).toBe(antes - 1);

  // a reserva some do aparelho (como no celular do piloto): a baixa sai dos lotes prontos da espécie
  const doacaoId = String((await lerDoServidor('doacao')).find((d) => d.codigo === codigo)!.id);
  const itens = (await lerDoServidor('doacao_item')).filter((i) => i.doacao_id === doacaoId);
  for (const r of (await lerDoServidor('reserva')).filter((x) => itens.some((i) => i.id === x.doacao_item_id))) {
    await fetch(`${PB()}/api/collections/reserva/records/${String(r.id)}`, { method: 'PATCH', headers: admin(), body: JSON.stringify({ situacao: 'cancelada', seq: 999999 }) });
  }
  await page.reload();
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await page.getByRole('link', { name: 'As mudas saíram (dar baixa)' }).click();
  await expect(page.getByText(new RegExp(`${ESPECIE} · aprovadas 1 · sai dos lotes prontos`))).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel(`Entregues de ${ESPECIE}`)).toHaveValue('1');
  await page.getByLabel('Nome').fill('Recebedor Balcão');
  await assinar(page);
  // zero mudas não vale como retirada
  await page.getByLabel(`Entregues de ${ESPECIE}`).fill('0');
  await page.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(page.getByText('Informe quantas mudas saíram (pelo menos 1).')).toBeVisible();
  await page.getByLabel(`Entregues de ${ESPECIE}`).fill('1');
  await page.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(page.getByTestId('resumo-pedido')).toContainText('retirado');
  await expect(page.getByTestId('itens-pedido')).toContainText('1');
  await expect.poll(async () => (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.referencia === codigo).map((m) => m.quantidade), { timeout: 20_000 }).toEqual([1]);
  await expect.poll(() => noCatalogo(ESPECIE), { timeout: 20_000 }).toBe(antes - 1);
});

test('pedido que ficou "retirado" sem nenhuma muda baixada: completar a retirada', async ({ page }) => {
  const h = admin();
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: h, body: JSON.stringify(dados) })).json()) as { id: string };
  // espécie e lote só deste teste
  const especie = await criar('especie', { nome_cientifico: 'Completaia demonstrativa', familia: 'Testaceae' });
  await criar('nome_popular', { especie_id: especie.id, nome: 'Árvore-para-completar', nome_busca: 'arvore para completar' });
  const loteC = await criar('lote_mudas', { codigo: 'LM-2026-I-903', especie_id: especie.id, fase_atual: 'pronta', origem: 'estoque_inicial', situacao: 'ativo', viveiro_id: 'vivteste0000001' });
  await criar('movimento_estoque_mudas', { lote_mudas_id: loteC.id, tipo: 'entrada', quantidade: 5, data: '2026-03-01', viveiro_id: 'vivteste0000001' });
  const pessoa = await criar('pessoa', { nome: 'Pedido Vazio', viveiro_id: 'vivteste0000001' });
  const d = await criar('doacao', { codigo: 'DO-2026-777', solicitante_pessoa_id: pessoa.id, situacao: 'retirada', viveiro_id: 'vivteste0000001', versao: 1, seq: 990000 });
  await criar('doacao_item', { doacao_id: d.id, especie_id: especie.id, qtd_pedida: 1, qtd_aprovada: 1, qtd_entregue: 0, viveiro_id: 'vivteste0000001', versao: 1, seq: 990001 });
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  // plantio antes de completar: explica por que não há o que plantar
  await page.goto(`/pos-plantio/novo/${d.id}`);
  await expect(page.getByTestId('sem-entregues')).toContainText('Completar a retirada', { timeout: 20_000 });
  await page.goto(`/doacao/${d.id}`);
  const aviso = page.getByTestId('retirada-vazia');
  await expect(aviso).toContainText('nenhuma muda saiu do estoque', { timeout: 20_000 });
  await aviso.getByRole('link', { name: 'Completar a retirada (dar baixa)' }).click();
  await expect(page.getByText('nenhuma muda foi baixada do estoque')).toBeVisible();
  await page.getByLabel('Nome').fill('Recebedor Corrigido');
  await assinar(page);
  await page.getByRole('button', { name: 'Confirmar: as mudas saíram do viveiro' }).click();
  await expect(page.getByTestId('retirada-vazia')).toHaveCount(0);
  await expect(page.getByTestId('itens-pedido')).toContainText('1');
  await expect.poll(async () => (await lerDoServidor('movimento_estoque_mudas')).filter((m) => m.referencia === 'DO-2026-777').map((m) => m.quantidade), { timeout: 20_000 }).toEqual([1]);
  // agora o plantio tem o campo de quantas foram plantadas (e depois as fotos com GPS)
  await page.goto(`/pos-plantio/novo/${d.id}`);
  await expect(page.getByLabel('Plantadas de Árvore-para-completar')).toHaveValue('1');
});

test('lote zerado some do viveiro (fica no histórico e nos relatórios)', async ({ page }) => {
  const h = admin();
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: h, body: JSON.stringify(dados) })).json()) as { id: string };
  const esp = await criar('especie', { nome_cientifico: 'Vaziaia demonstrativa', familia: 'Testaceae' });
  await criar('nome_popular', { especie_id: esp.id, nome: 'Árvore-que-acabou', nome_busca: 'arvore que acabou' });
  const lote = await criar('lote_mudas', { codigo: 'LM-2026-I-902', especie_id: esp.id, fase_atual: 'pronta', origem: 'estoque_inicial', situacao: 'ativo', viveiro_id: 'vivteste0000001' });
  await criar('movimento_estoque_mudas', { lote_mudas_id: lote.id, tipo: 'entrada', quantidade: 2, data: '2026-03-01', viveiro_id: 'vivteste0000001' });
  await criar('movimento_estoque_mudas', { lote_mudas_id: lote.id, tipo: 'saida_doacao', quantidade: 2, data: '2026-04-01', viveiro_id: 'vivteste0000001' });
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto('/viveiro');
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-902' })).toHaveCount(0);
  await page.getByRole('button', { name: /Prontas para doação/ }).click();
  await expect(page.locator('.item-lista', { hasText: 'LM-2026-I-902' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Sem mudas/ })).toHaveCount(0);
  // continua no histórico: o rastreio do lote abre
  await page.goto('/rastreio/LM-2026-I-902');
  await expect(page.getByTestId('cadeia')).toContainText('LM-2026-I-902', { timeout: 20_000 });
});
