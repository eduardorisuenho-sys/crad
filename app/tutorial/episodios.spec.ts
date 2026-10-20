/**
 * Telas dos vídeos do manual (uma pasta por episódio, com cenas.json).
 * Rodar: CRADS_TUTORIAL_DIR=/tmp/telas npx playwright test -c tutorial
 * Os episódios seguem o caminho real da muda e dependem um do outro (em série).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { entrar, PB } from '../e2e/apoio';

const PASTA = process.env.CRADS_TUTORIAL_DIR;
const foto = fileURLToPath(new URL('../e2e/fixtures/foto.jpg', import.meta.url));
const ARVORE = { latitude: -10.1844, longitude: -48.3336, accuracy: 5 };
const SITIO = { latitude: -10.2491, longitude: -48.3243, accuracy: 6 };

test.skip(!PASTA, 'só gera as telas com CRADS_TUTORIAL_DIR');
test.describe.configure({ mode: 'serial' });

class Gravador {
  private cenas: { id: string; imagem: string; alvo: { x: number; y: number; w: number; h: number } | null }[] = [];
  private dir: string;
  constructor(
    private page: Page,
    episodio: string,
  ) {
    this.dir = join(PASTA!, episodio);
    mkdirSync(this.dir, { recursive: true });
  }
  trocar(page: Page) {
    this.page = page;
  }
  async cena(id: string, alvo?: Locator) {
    if (alvo) await alvo.first().scrollIntoViewIfNeeded();
    else await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.page.waitForTimeout(450);
    const escala = await this.page.evaluate(() => window.devicePixelRatio);
    const caixa = alvo ? await alvo.first().boundingBox() : null;
    const imagem = `${id}.png`;
    await this.page.screenshot({ path: join(this.dir, imagem) });
    this.cenas.push({ id, imagem, alvo: caixa && { x: caixa.x * escala, y: caixa.y * escala, w: caixa.width * escala, h: caixa.height * escala } });
  }
  salvar() {
    writeFileSync(join(this.dir, 'cenas.json'), JSON.stringify({ cenas: this.cenas }, null, 2));
  }
}

async function contexto(browser: Browser, geo = ARVORE): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: geo, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => void d.accept());
  return [ctx, page];
}
const sincronizado = (p: Page) => expect(p.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 30_000 });
const botao = (p: Page, nome: string | RegExp) => p.getByRole('button', { name: nome });
const link = (p: Page, nome: string | RegExp) => p.getByRole('link', { name: nome });

// estado que passa de um episódio para o outro
let matriz = '';
let pedido = '';
let loteMudas = '';

test('01 · Criar conta e entrar', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '01-conta');
  await p.goto('/');
  await p.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await p.reload();
  await g.cena('entrar', link(p, 'Criar conta'));
  await link(p, 'Criar conta').click();
  await g.cena('perfil', botao(p, /Vou coletar sementes/));
  await botao(p, /Vou coletar sementes/).click();
  await p.getByLabel('Nome completo').fill('Marcos Rocha');
  await p.getByLabel('E-mail').fill('marcos@crad.local');
  await p.getByLabel(/^Senha/).fill('senha-marcos-1');
  await g.cena('dados', botao(p, 'Criar conta'));
  await botao(p, 'Criar conta').click();
  await expect(p.getByTestId('aguardando-acesso')).toBeVisible();
  await g.cena('aguardando', p.getByTestId('aguardando-acesso'));
  await ctx.close();

  // quem pede mudas entra na hora
  const [ctx2, s] = await contexto(browser);
  g.trocar(s);
  await s.goto('/');
  await s.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await s.goto('/criar-conta');
  await g.cena('perfil-mudas', botao(s, /Quero pedir mudas/));
  await botao(s, /Quero pedir mudas/).click();
  await s.getByLabel('Nome completo').fill('Lúcia Alves');
  await s.getByLabel('E-mail').fill('lucia@crad.local');
  await s.getByLabel(/^Senha/).fill('senha-lucia-1');
  await botao(s, 'Criar conta').click();
  await expect(s.getByRole('heading', { name: 'Olá, Lúcia' })).toBeVisible();
  await g.cena('entrou', s.locator('.grade-blocos'));
  await ctx2.close();

  // quem já tem conta: e-mail e senha
  const [ctx3, e] = await contexto(browser);
  g.trocar(e);
  await e.goto('/');
  await e.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await e.reload();
  await e.getByLabel('E-mail').fill('ana@crad.local');
  await e.getByLabel('Senha').fill('senha-teste-123');
  await g.cena('ja-tenho', botao(e, 'Entrar'));
  await ctx3.close();
  g.salvar();
});

test('02 · A tela inicial e o trabalho sem internet', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '02-inicio');
  await entrar(p, 'ana@crad.local', 'Olá, Ana');
  await sincronizado(p);
  await g.cena('inicio');
  await g.cena('viveiro', p.locator('.viveiro-atual'));
  await g.cena('botoes', p.locator('.grade-blocos'));
  await g.cena('barra', p.getByTestId('barra-sync'));
  await link(p, 'Ajustes').click();
  await g.cena('preparar', botao(p, 'Preparar para ir a campo'));
  await botao(p, 'Preparar para ir a campo').click();
  await expect(p.getByText('Pronto para ir a campo.')).toBeVisible();
  await g.cena('pronto', p.getByText('Pronto para ir a campo.'));
  await botao(p, 'Voltar').click();
  await ctx.setOffline(true);
  await expect(p.getByTestId('barra-sync')).toContainText('Sem sinal');
  await g.cena('sem-sinal', p.getByTestId('barra-sync'));
  await ctx.setOffline(false);
  await sincronizado(p);
  await ctx.close();
  g.salvar();
});

test('03 · Cadastrar uma matriz', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '03-matriz');
  await entrar(p, 'ana@crad.local', 'Olá, Ana');
  await sincronizado(p);
  await link(p, 'Ajustes').click();
  await botao(p, 'Preparar para ir a campo').click();
  await expect(p.getByText('Pronto para ir a campo.')).toBeVisible();
  await botao(p, 'Voltar').click();
  await ctx.setOffline(true);
  await g.cena('matrizes', link(p, 'Matrizes'));
  await link(p, 'Matrizes').click();
  await g.cena('cadastrar', link(p, 'Cadastrar matriz'));
  await link(p, 'Cadastrar matriz').click();
  await expect(p.getByTestId('gps')).toContainText('±5 m');
  await g.cena('gps', botao(p, 'Usar este ponto'));
  await botao(p, 'Usar este ponto').click();
  await g.cena('especie', botao(p, 'Já sei o nome'));
  await botao(p, 'Já sei o nome').click();
  await p.getByLabel('Nome da espécie').fill('ipe');
  await g.cena('especie-nome', botao(p, /Ipê-amarelo/));
  await botao(p, /Ipê-amarelo/).click();
  await g.cena('certeza', botao(p, 'Tenho certeza'));
  await botao(p, 'Tenho certeza').click();
  await g.cena('fotos', p.locator('label', { hasText: 'Árvore inteira' }));
  await p.locator('label', { hasText: 'Árvore inteira' }).locator('input').setInputFiles(foto);
  await p.locator('label', { hasText: 'Folhas' }).locator('input').setInputFiles(foto);
  await expect(p.locator('label.opcao.ativa')).toHaveCount(2);
  await g.cena('fotos-ok', botao(p, 'Continuar'));
  await botao(p, 'Continuar').click();
  await p.getByLabel('Altura (metros, aproximada)').fill('14');
  await p.getByLabel('DAP (centímetros)').fill('38');
  await botao(p, 'Boa, saudável').click();
  await botao(p, 'Mata').click();
  await g.cena('arvore', p.getByLabel('Altura (metros, aproximada)'));
  await botao(p, 'Continuar').click();
  await p.getByLabel('Nome').fill('Maria da Silva');
  await p.getByLabel('O dono autorizou a entrada e a coleta').check();
  await g.cena('dono', p.getByLabel('O dono autorizou a entrada e a coleta'));
  await botao(p, 'Continuar').click();
  await g.cena('salvar', botao(p, 'Salvar matriz'));
  await botao(p, 'Salvar matriz').click();
  await expect(p.getByTestId('matriz-salva')).toBeVisible();
  matriz = (await p.locator('.codigo-grande').innerText()).trim();
  await g.cena('plaqueta', p.getByTestId('plaqueta'));
  await botao(p, 'Fruto maduro').click();
  await g.cena('visita', botao(p, 'Registrar visita'));
  await botao(p, 'Registrar visita').click();
  await expect(p.getByText('Fenologia registrada.')).toBeVisible();
  await ctx.setOffline(false);
  await sincronizado(p);
  matriz = (await p.locator('.codigo-grande').innerText()).trim();
  await ctx.close();
  g.salvar();
});

test('04 · Registrar uma coleta', async ({ browser }) => {
  // de volta à estrada, a uns 400 m da árvore
  const [ctx, p] = await contexto(browser, { ...ARVORE, latitude: ARVORE.latitude - 0.0036 });
  const g = new Gravador(p, '04-coleta');
  await entrar(p, 'ana@crad.local', 'Olá, Ana');
  await sincronizado(p);
  await ctx.setOffline(true);
  await g.cena('modulo', link(p, 'Coleta e sementes'));
  await link(p, 'Coleta e sementes').click();
  await g.cena('rota-botao', link(p, 'Rota de coleta'));
  await link(p, 'Rota de coleta').click();
  await p.locator('.item-lista', { hasText: matriz }).click();
  await g.cena('rota', p.getByTestId('rota-escolhida'));
  await p.goto('/coleta');
  await g.cena('registrar', link(p, 'Registrar coleta'));
  await link(p, 'Registrar coleta').click();
  await g.cena('escolher', botao(p, new RegExp(matriz)));
  await botao(p, new RegExp(matriz)).click();
  await p.getByLabel('Quantidade').fill('2,5');
  await botao(p, 'Quilos (kg)').click();
  await g.cena('quantidade', p.getByLabel('Quantidade'));
  await botao(p, 'Continuar').click();
  await g.cena('material', botao(p, 'Frutos'));
  await botao(p, 'Frutos').click();
  await g.cena('foto', botao(p, 'Pular a foto'));
  await botao(p, 'Pular a foto').click();
  await g.cena('salvar', botao(p, 'Salvar coleta'));
  await botao(p, 'Salvar coleta').click();
  await expect(p.getByText('Coleta salva')).toBeVisible();
  await g.cena('salva', p.getByText('Coleta salva'));
  await p.goto('/coleta/nova');
  await g.cena('botao-verde', botao(p, /^Coleta/));
  await ctx.setOffline(false);
  await p.goto('/');
  await sincronizado(p);
  await g.cena('enviado', p.getByTestId('barra-sync'));
  await ctx.close();
  g.salvar();
});

test('05 · O lote de sementes', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '05-sementes');
  await entrar(p, 'bruno@crad.local', 'Olá, Bruno');
  await sincronizado(p);
  // o servidor transforma a coleta em lote; espera chegar ao aparelho
  await expect(async () => {
    await p.goto('/coleta');
    await expect(p.locator('a.item-lista', { hasText: matriz }).filter({ hasText: '2,5 kg' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await p.goto('/');
  await g.cena('modulo', link(p, 'Coleta e sementes'));
  await link(p, 'Coleta e sementes').click();
  await g.cena('lista', p.locator('a.item-lista', { hasText: matriz }));
  await p.locator('a.item-lista', { hasText: matriz }).first().click();
  await expect(async () => {
    await p.reload();
    await expect(link(p, 'Abrir o lote de sementes')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await g.cena('ficha', link(p, 'Abrir o lote de sementes'));
  await link(p, 'Abrir o lote de sementes').click();
  await p.getByTestId('pesar-sementes').getByLabel('Peso das sementes limpas (gramas)').fill('800');
  await g.cena('pesar', botao(p, 'Salvar peso'));
  await botao(p, 'Salvar peso').click();
  await expect(p.getByTestId('saldo')).toHaveText('800 g');
  await g.cena('saldo', p.getByTestId('saldo'));
  await g.cena('etiqueta', botao(p, 'Imprimir etiqueta'));
  await botao(p, 'Teste de germinação').click();
  await p.getByLabel('Gramas').fill('20');
  await p.getByLabel('Resultado do teste: % que germinou (opcional)').fill('85');
  await g.cena('teste', botao(p, 'Registrar').last());
  await p.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(p.getByTestId('saldo')).toHaveText('780 g');
  await sincronizado(p);
  await ctx.close();
  g.salvar();
});

test('06 · Cadastro de mudas', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '06-mudas');
  await entrar(p, 'bruno@crad.local', 'Olá, Bruno');
  await sincronizado(p);
  // mudas que já estavam no viveiro
  await g.cena('modulo', link(p, 'Viveiro'));
  await link(p, 'Viveiro').first().click();
  await g.cena('registrar', link(p, /Registrar mudas/));
  await link(p, /Registrar mudas/).click();
  await g.cena('formas', botao(p, /Uma espécie por vez/));
  await botao(p, /Uma espécie por vez/).click();
  await p.getByLabel('Nome da espécie').fill('jatoba');
  await botao(p, /Jatobá/).click();
  await p.getByLabel('Quantas mudas?').fill('40');
  await p.locator('label', { hasText: 'Tirar foto das mudas' }).locator('input').setInputFiles(foto);
  await expect(p.getByRole('img', { name: 'Foto das mudas' })).toBeVisible();
  await g.cena('quantas', p.getByLabel('Quantas mudas?'));
  await g.cena('salvar', botao(p, 'Salvar'));
  await botao(p, 'Salvar').click();
  await expect(p.getByText(/40 mudas|Jatobá/).first()).toBeVisible();
  await g.cena('salvo');
  // semear sementes de um lote
  await p.goto('/coleta');
  await p.locator('a.item-lista', { hasText: matriz }).first().click();
  await link(p, 'Abrir o lote de sementes').click();
  await g.cena('semear', link(p, 'Semear deste lote'));
  await link(p, 'Semear deste lote').click();
  await p.getByLabel('Número de sementes').fill('200');
  await p.getByLabel('Peso (gramas)').fill('100');
  await g.cena('quantas-sementes', p.getByLabel('Número de sementes'));
  await botao(p, 'Continuar').click();
  await botao(p, 'Tubete').click();
  await p.getByLabel('Canteiro (opcional)').fill('C3');
  await g.cena('recipiente', botao(p, 'Tubete'));
  await botao(p, 'Continuar').click();
  await g.cena('criar', botao(p, 'Criar lote de mudas'));
  await botao(p, 'Criar lote de mudas').click();
  await expect(p.getByTestId('etiqueta-lm')).toBeVisible();
  loteMudas = p.url();
  await g.cena('lote-criado', p.getByTestId('etiqueta-lm'));
  await sincronizado(p);
  await ctx.close();
  g.salvar();
});

test('07 · Cuidar das mudas', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '07-cuidar');
  await entrar(p, 'bruno@crad.local', 'Olá, Bruno');
  await sincronizado(p);
  await p.goto(new URL(loteMudas).pathname);
  const registrar = (acao: string) => p.getByRole('button', { name: acao, exact: true });
  await g.cena('lote', registrar('Contar germinação'));
  await registrar('Contar germinação').click();
  await p.getByLabel('Total de plântulas nascidas até hoje').fill('150');
  await g.cena('germinacao', p.getByLabel('Total de plântulas nascidas até hoje'));
  await registrar('Registrar').click();
  await expect(p.getByTestId('germinacao')).toHaveText('150 de 200 (75%)');
  await registrar('Perda').click();
  await p.getByLabel('Quantas mudas morreram ou foram descartadas').fill('10');
  await botao(p, 'Praga ou formiga').click();
  await g.cena('perda', p.getByLabel('Quantas mudas morreram ou foram descartadas'));
  await registrar('Registrar').click();
  await expect(p.getByTestId('saldo-mudas')).toHaveText('140');
  await g.cena('pronta', registrar('Marcar como pronta'));
  await registrar('Marcar como pronta').click();
  await registrar('Registrar').click();
  await expect(p.getByTestId('resumo-lm')).toContainText('Pronta para doação');
  await g.cena('pronta-ok', p.getByTestId('resumo-lm'));
  await g.cena('fotos', p.getByTestId('fotos-lote'));
  await botao(p, 'Editar o lote de mudas').click();
  await g.cena('editar', p.getByTestId('editar-registro'));
  await botao(p, 'Cancelar').click().catch(() => {});
  await p.goto('/viveiro');
  await g.cena('inventario-botao', link(p, 'Inventário'));
  await link(p, 'Inventário').click();
  await expect(p.getByLabel(/^Contado em LM-/).first()).toBeVisible();
  for (const campo of await p.getByLabel(/^Contado em LM-/).all()) {
    const nome = (await campo.getAttribute('aria-label')) ?? '';
    await campo.fill(/-I-/.test(nome) ? '40' : '138');
  }
  await g.cena('inventario', p.getByLabel(/^Contado em LM-/).last());
  await g.cena('fechar', botao(p, /Fechar inventário/));
  await botao(p, /Fechar inventário/).click();
  await expect(p.getByText(/Inventário fechado/)).toBeVisible();
  await g.cena('fechado', p.getByText(/Inventário fechado/));
  await sincronizado(p);
  await ctx.close();
  g.salvar();
});

test('08 · Pedir mudas', async ({ browser }) => {
  const [ctx, s] = await contexto(browser);
  const g = new Gravador(s, '08-pedir');
  await entrar(s, 'jose@crad.local', 'Olá, José');
  await sincronizado(s);
  await g.cena('catalogo-botao', link(s, 'Catálogo'));
  await link(s, 'Catálogo').first().click();
  await expect(s.locator('.cartao-especie').first()).toBeVisible({ timeout: 20_000 });
  await g.cena('catalogo', s.locator('.cartao-especie').first());
  await s.goto('/doacao');
  await g.cena('pedir', link(s, 'Pedir mudas'));
  await link(s, 'Pedir mudas').click();
  await s.getByLabel('Quantidade de Jatobá').fill('20');
  await g.cena('quantidade', s.getByLabel('Quantidade de Jatobá'));
  await botao(s, /Continuar/).click();
  await botao(s, 'Beira de rio ou nascente').click();
  await s.getByLabel('Município').fill('Palmas');
  await s.getByLabel('Endereço ou como chegar').fill('Sítio Boa Vista, estrada do Taquaruçu');
  await s.getByLabel('Área aproximada (hectares)').fill('0,5');
  await g.cena('onde', s.getByLabel('Área aproximada (hectares)'));
  await botao(s, 'Continuar').click();
  await s.getByLabel(/Instituição/).fill('particular');
  await s.getByLabel('CPF').fill('529.982.247-25');
  await s.getByLabel('Telefone').fill('63 99999-1234');
  await g.cena('dados', s.getByLabel('Telefone'));
  await botao(s, 'Continuar').click();
  await s.getByTestId('termo').getByRole('button', { name: 'Ler o termo' }).click();
  await g.cena('termo', s.getByTestId('texto-termo'));
  await s.getByLabel('Li e aceito o termo de compromisso e declaração').check();
  await g.cena('enviar', botao(s, 'Enviar pedido'));
  await botao(s, 'Enviar pedido').click();
  await expect(s.getByTestId('aviso-oficio')).toBeVisible();
  await g.cena('oficio', s.getByTestId('aviso-oficio'));
  await sincronizado(s);
  await expect.poll(async () => (await s.getByRole('heading', { level: 1 }).innerText()).trim(), { timeout: 20_000 }).toMatch(/^Pedido DO-\d{4}-\d{3}$/);
  pedido = (await s.getByRole('heading', { level: 1 }).innerText()).replace('Pedido ', '').trim();
  await ctx.close();
  g.salvar();
});

test('09 · Analisar e aprovar pedidos', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '09-aprovar');
  await entrar(p, 'carla@crad.local', 'Olá, Carla');
  await sincronizado(p);
  await expect(p.getByTestId('pendencias-doacao')).toBeVisible({ timeout: 20_000 });
  await g.cena('numero', p.getByTestId('pendencias-doacao'));
  await link(p, /^Doação de mudas/).click();
  await g.cena('lista', p.locator('.item-lista', { hasText: pedido }));
  await p.locator('.item-lista', { hasText: pedido }).click();
  await g.cena('agua', p.getByTestId('plantando-agua'));
  await p.getByTestId('plantando-agua').click();
  await g.cena('analisar', botao(p, 'Analisar pedido'));
  await botao(p, 'Analisar pedido').click();
  await p.getByLabel('Aprovar de Jatobá').fill('20');
  await g.cena('aprovar', botao(p, 'Aprovar e reservar'));
  await botao(p, 'Aprovar e reservar').click();
  await expect(p.getByText('Pedido aprovado e mudas reservadas.')).toBeVisible();
  await g.cena('aprovado', p.getByTestId('resumo-pedido'));
  await ctx.close();
  g.salvar();
});

test('10 · Entregar as mudas', async ({ browser }) => {
  const [ctx, v] = await contexto(browser);
  const g = new Gravador(v, '10-entregar');
  await entrar(v, 'bruno@crad.local', 'Olá, Bruno');
  await sincronizado(v);
  await v.goto('/doacao');
  await g.cena('aguardando', botao(v, 'Aguardando retirada'));
  await botao(v, 'Aguardando retirada').click();
  await v.locator('.item-lista', { hasText: pedido }).click();
  const combinar = v.getByTestId('combinar-retirada');
  await g.cena('telefone', combinar.getByRole('button', { name: 'Ver telefone de quem pediu' }));
  await combinar.getByRole('button', { name: 'Ver telefone de quem pediu' }).click();
  await expect(combinar.getByTestId('contato')).toBeVisible();
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await combinar.getByLabel('Dia combinado').fill(amanha);
  await combinar.getByLabel(/Observação/).fill('às 8h, vem de caminhonete');
  await g.cena('combinar', combinar.getByRole('button', { name: 'Salvar dia combinado' }));
  await combinar.getByRole('button', { name: 'Salvar dia combinado' }).click();
  await g.cena('baixa', link(v, 'As mudas saíram (dar baixa)'));
  await link(v, 'As mudas saíram (dar baixa)').click();
  await v.getByLabel('Entregues de Jatobá').fill('20');
  await v.getByLabel('Nome').fill('José Pereira');
  const tela = v.getByLabel('Área para assinar');
  const caixa = (await tela.boundingBox())!;
  const toque = (tipo: string, x: number, y: number) => tela.dispatchEvent(tipo, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: caixa.x + x, clientY: caixa.y + y });
  await toque('pointerdown', 30, 110);
  for (const [x, y] of [[70, 70], [120, 50], [160, 95], [210, 60], [260, 100]]) await toque('pointermove', x, y);
  await toque('pointerup', 260, 100);
  await g.cena('assinar', tela);
  await g.cena('confirmar', botao(v, 'Confirmar: as mudas saíram do viveiro'));
  const termo = v.waitForEvent('download');
  await botao(v, 'Confirmar: as mudas saíram do viveiro').click();
  await termo;
  await expect(v.getByTestId('resumo-pedido')).toContainText('retirado');
  await g.cena('entregue', v.getByTestId('resumo-pedido'));
  await sincronizado(v);
  await ctx.close();
  g.salvar();
});

test('11 · Pós-plantio', async ({ browser }) => {
  const [ctx, s] = await contexto(browser, SITIO);
  const g = new Gravador(s, '11-plantio');
  await entrar(s, 'jose@crad.local', 'Olá, José');
  await sincronizado(s);
  await g.cena('modulo', link(s, /^Pós-plantio/));
  await link(s, /^Pós-plantio/).click();
  await g.cena('lista', s.locator('.item-lista', { hasText: pedido }));
  await s.locator('.item-lista', { hasText: pedido }).click();
  await s.getByLabel('Plantadas de Jatobá').fill('20');
  await g.cena('plantadas', s.getByLabel('Plantadas de Jatobá'));
  await botao(s, 'Continuar').click();
  await botao(s, 'Estou no local: marcar o ponto').click();
  await expect(botao(s, /Ponto marcado/)).toBeVisible();
  await s.getByLabel('Município').fill('Palmas');
  await g.cena('local', botao(s, /Ponto marcado/));
  await botao(s, 'Continuar').click();
  await s.locator('label', { hasText: 'Tirar foto' }).locator('input').setInputFiles(foto);
  await expect(s.locator('.galeria figcaption').first()).toContainText('GPS');
  await g.cena('foto', s.locator('.galeria').first());
  await botao(s, 'Salvar plantio').click();
  await expect(s.getByText('Plantio registrado')).toBeVisible();
  await g.cena('registrado', s.getByText('Plantio registrado'));
  await link(s, 'Novo acompanhamento').click();
  await s.getByLabel('Vivas de Jatobá').fill('18');
  await g.cena('acompanhamento', s.getByLabel('Vivas de Jatobá'));
  await botao(s, 'Salvar acompanhamento').click();
  await expect(s.getByTestId('sobrevivencia')).toContainText('90%');
  await g.cena('sobrevivencia', s.getByTestId('sobrevivencia'));
  await sincronizado(s);
  await g.cena('relatorio', botao(s, 'Baixar relatório do plantio (PDF)'));
  await ctx.close();
  g.salvar();
});

test('12 · Para a gestão', async ({ browser }) => {
  const [ctx, p] = await contexto(browser);
  const g = new Gravador(p, '12-gestao');
  await entrar(p, 'carla@crad.local', 'Olá, Carla');
  await sincronizado(p);
  await g.cena('equipe-botao', link(p, /^Equipe/));
  await link(p, /^Equipe/).click();
  const pedidoAcesso = p.locator('.pedido-acesso', { hasText: 'marcos@crad.local' });
  await g.cena('acesso', pedidoAcesso.getByRole('button', { name: 'Aprovar' }));
  await pedidoAcesso.getByRole('button', { name: 'Aprovar' }).click();
  await expect(p.getByText('Marcos Rocha agora faz parte da equipe.')).toBeVisible();
  await g.cena('aprovado', p.getByText('Marcos Rocha agora faz parte da equipe.'));
  await p.goto('/');
  await link(p, /^Relatórios/).click();
  await botao(p, 'Tudo').click();
  await g.cena('relatorios', p.getByTestId('indicadores'));
  await g.cena('baixar', botao(p, 'Planilha'));
  await p.goto('/');
  await link(p, /^Lixeira/).click();
  await g.cena('lixeira', p.getByLabel('Procurar cadastro'));
  await ctx.close();
  g.salvar();
});
