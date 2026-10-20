/**
 * Telas do vídeo-tutorial "Matrizes e coleta de sementes" (para quem vai a campo).
 * Não roda com os outros testes: só com CRADS_TUTORIAL_DIR=<pasta>, que recebe
 * as imagens e o arquivo cenas.json (imagem + botão a destacar em cada cena).
 * Quem monta o vídeo é docs/tutorial/montar_video.py.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { entrar, PB } from './apoio';

const PASTA = process.env.CRADS_TUTORIAL_DIR;
const foto = fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url));
const ARVORE = { latitude: -10.1844, longitude: -48.3336, accuracy: 5 };

test.skip(!PASTA, 'só gera as telas do tutorial com CRADS_TUTORIAL_DIR');
test.use({ permissions: ['geolocation'], geolocation: ARVORE });

interface Cena {
  id: string;
  imagem: string;
  /** botão a destacar, em pixels da imagem */
  alvo: { x: number; y: number; w: number; h: number } | null;
}

test('telas do tutorial do coletor', async ({ page, context }) => {
  test.setTimeout(180_000);
  const cenas: Cena[] = [];
  const escala = page.viewportSize() ? await page.evaluate(() => window.devicePixelRatio) : 1;
  async function cena(id: string, alvo?: Locator) {
    if (alvo) await alvo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const caixa = alvo ? await alvo.boundingBox() : null;
    const imagem = `${String(cenas.length + 1).padStart(2, '0')}-${id}.png`;
    await page.screenshot({ path: join(PASTA!, imagem) });
    cenas.push({ id, imagem, alvo: caixa && { x: caixa.x * escala, y: caixa.y * escala, w: caixa.width * escala, h: caixa.height * escala } });
  }

  // uma coletora e o Ipê-amarelo (Handroanthus serratifolius, Bignoniaceae)
  const h = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: h, body: JSON.stringify({ versao: 1, ...dados }) })).json()) as { id: string };
  const ana = await criar('users', { email: 'ana@tutorial.local', password: 'senha-teste-123', passwordConfirm: 'senha-teste-123', name: 'Ana Clara' });
  // viveiro só do tutorial: nas telas aparecem só as matrizes da Ana
  const viveiro = await criar('viveiro', { id: 'vivtutorial0001', sigla: 'CRP', nome: 'CRAD Palmas', ativo: true });
  await criar('usuario_viveiro', { usuario_id: ana.id, perfil: 'coletor', viveiro_id: viveiro.id });
  const ipe = await criar('especie', { nome_cientifico: 'Handroanthus serratifolius', familia: 'Bignoniaceae' });
  await criar('nome_popular', { especie_id: ipe.id, nome: 'Ipê-amarelo', nome_busca: 'ipe amarelo' });

  await entrar(page, 'ana@tutorial.local', 'Olá, Ana');
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await cena('inicio');

  // antes de sair: preparar para ir a campo
  await cena('abrir-ajustes', page.getByRole('link', { name: 'Ajustes' }));
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await cena('preparar', page.getByRole('button', { name: 'Preparar para ir a campo' }));
  await page.getByRole('button', { name: 'Preparar para ir a campo' }).click();
  await expect(page.getByText('Pronto para ir a campo.')).toBeVisible();
  await cena('pronto', page.getByText('Pronto para ir a campo.'));
  await page.getByRole('button', { name: 'Voltar' }).click();

  // no mato, sem internet
  await context.setOffline(true);
  await expect(page.getByTestId('barra-sync')).toContainText('Sem sinal');
  await cena('matrizes', page.getByRole('link', { name: 'Matrizes' }));
  await page.getByRole('link', { name: 'Matrizes' }).click();
  await cena('cadastrar', page.getByRole('link', { name: 'Cadastrar matriz' }));
  await page.getByRole('link', { name: 'Cadastrar matriz' }).click();

  await expect(page.getByTestId('gps')).toContainText('±5 m');
  await cena('gps', page.getByRole('button', { name: 'Usar este ponto' }));
  await page.getByRole('button', { name: 'Usar este ponto' }).click();
  await cena('especie', page.getByRole('button', { name: 'Já sei o nome' }));
  await page.getByRole('button', { name: 'Já sei o nome' }).click();
  await page.getByLabel('Nome da espécie').fill('ipe');
  await cena('especie-nome', page.getByRole('button', { name: /Ipê-amarelo/ }));
  await page.getByRole('button', { name: /Ipê-amarelo/ }).click();
  await cena('certeza', page.getByRole('button', { name: 'Tenho certeza' }));
  await page.getByRole('button', { name: 'Tenho certeza' }).click();

  await cena('fotos', page.locator('label', { hasText: 'Árvore inteira' }));
  await page.locator('label', { hasText: 'Árvore inteira' }).locator('input').setInputFiles(foto);
  await page.locator('label', { hasText: 'Folhas' }).locator('input').setInputFiles(foto);
  await expect(page.locator('label.opcao.ativa')).toHaveCount(2);
  await cena('fotos-ok', page.getByRole('button', { name: 'Continuar' }));
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Altura (metros, aproximada)').fill('14');
  await page.getByLabel('DAP (centímetros)').fill('38');
  await page.getByRole('button', { name: 'Boa, saudável' }).click();
  await page.getByRole('button', { name: 'Mata' }).click();
  await cena('arvore', page.getByLabel('Altura (metros, aproximada)'));
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Nome').fill('Maria da Silva');
  await page.getByLabel('O dono autorizou a entrada e a coleta').check();
  await cena('dono', page.getByLabel('O dono autorizou a entrada e a coleta'));
  await page.getByRole('button', { name: 'Continuar' }).click();

  await cena('salvar', page.getByRole('button', { name: 'Salvar matriz' }));
  await page.getByRole('button', { name: 'Salvar matriz' }).click();
  await expect(page.getByTestId('matriz-salva')).toBeVisible();
  const codigo = (await page.locator('.codigo-grande').innerText()).trim();
  await cena('plaqueta', page.getByTestId('plaqueta'));

  await page.getByRole('button', { name: 'Fruto maduro', exact: true }).click();
  await cena('visita', page.getByRole('button', { name: 'Fruto maduro', exact: true }));
  await page.getByRole('button', { name: 'Registrar visita' }).click();
  await expect(page.getByText('Fenologia registrada.')).toBeVisible();

  // hora de colher
  // de volta à estrada, a uns 400 m da árvore
  await context.setGeolocation({ ...ARVORE, latitude: ARVORE.latitude - 0.0036 });
  await page.goto('/');
  await cena('coleta-modulo', page.getByRole('link', { name: 'Coleta e sementes' }));
  await page.getByRole('link', { name: 'Coleta e sementes' }).click();
  await cena('rota-botao', page.getByRole('link', { name: 'Rota de coleta' }));
  await page.getByRole('link', { name: 'Rota de coleta' }).click();
  await page.locator('.item-lista', { hasText: codigo }).click();
  await cena('rota', page.getByTestId('rota-escolhida'));

  await page.goto('/coleta');
  await cena('registrar', page.getByRole('link', { name: 'Registrar coleta' }));
  await page.getByRole('link', { name: 'Registrar coleta' }).click();
  await cena('escolher-matriz', page.getByRole('button', { name: new RegExp(codigo) }));
  await page.getByRole('button', { name: new RegExp(codigo) }).click();
  await page.getByLabel('Quantidade').fill('2,5');
  await page.getByRole('button', { name: 'Quilos (kg)' }).click();
  await cena('quantidade', page.getByLabel('Quantidade'));
  await page.getByRole('button', { name: 'Continuar' }).click();
  await cena('material', page.getByRole('button', { name: 'Frutos' }));
  await page.getByRole('button', { name: 'Frutos' }).click();
  await cena('foto-coleta', page.getByRole('button', { name: 'Pular a foto' }));
  await page.getByRole('button', { name: 'Pular a foto' }).click();
  await cena('salvar-coleta', page.getByRole('button', { name: 'Salvar coleta' }));
  await page.getByRole('button', { name: 'Salvar coleta' }).click();
  await expect(page.getByText('Coleta salva')).toBeVisible();
  await cena('coleta-salva', page.getByText('Coleta salva'));

  // árvore que não é matriz: botão verde Coleta
  await page.goto('/coleta/nova');
  await cena('botao-verde', page.getByRole('button', { name: /^Coleta/ }));

  // volta a internet: tudo é enviado sozinho
  await context.setOffline(false);
  await page.goto('/');
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 30_000 });
  await cena('enviado', page.getByTestId('barra-sync'));

  writeFileSync(join(PASTA!, 'cenas.json'), JSON.stringify({ largura: page.viewportSize()!.width * escala, cenas }, null, 2));
});
