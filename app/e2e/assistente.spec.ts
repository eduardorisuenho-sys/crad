import { expect, test } from '@playwright/test';
import { ESPECIES_FICTICIAS, PERGUNTAS_PADRAO } from '@crads/dominio';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

test('assistente identifica uma espécie sem internet, uma pergunta por vez', async ({ page, context }) => {
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  // perguntas padrão pelo app; as espécies do teste (fictícias, só do teste) vão direto ao servidor de testes
  await page.getByRole('link', { name: 'Espécies' }).click();
  await page.getByText('Assistente de identificação').click();
  await expect(page.getByRole('button', { name: 'Espécies fictícias de treino' })).toHaveCount(0); // não existe mais no app
  await page.getByRole('button', { name: 'Criar perguntas padrão' }).click();
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const admin = { authorization: process.env.CRADS_PB_ADMIN!, 'content-type': 'application/json' };
  const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin, body: JSON.stringify(dados) })).json()) as { id: string };
  await expect.poll(async () => (await lerDoServidor('opcao')).length, { timeout: 20_000 }).toBeGreaterThan(10);
  const opcoes = new Map((await lerDoServidor('opcao')).map((o) => [String(o.chave), String(o.id)]));
  for (const f of ESPECIES_FICTICIAS) {
    const e = await criar('especie', { nome_cientifico: f.nome_cientifico, familia: f.familia, meses_flor: f.meses_flor, meses_fruto: f.meses_fruto, ficticia: true });
    await criar('nome_popular', { especie_id: e.id, nome: f.nome_popular, nome_busca: f.nome_popular.toLowerCase() });
    for (const o of f.opcoes) if (opcoes.has(o)) await criar('especie_opcao', { especie_id: e.id, opcao_id: opcoes.get(o) });
    for (const bioma of f.biomas) await criar('especie_ocorrencia', { especie_id: e.id, uf: 'TO', bioma, origem: 'manual' });
  }
  await page.reload();
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(async () => {
    const req = indexedDB.open('crads');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    return await new Promise<number>((ok) => {
      const r = db.transaction('especie_opcao').objectStore('especie_opcao').count();
      r.onsuccess = () => ok(r.result);
    });
  }), { timeout: 20_000 }).toBeGreaterThan(10);
  await context.setOffline(true);
  await page.goto('/');

  await page.getByRole('link', { name: 'Identificar árvore' }).click();
  await page.getByRole('button', { name: 'Só folhas · Continuar' }).click();

  // Responde como se estivesse diante da "Ficticia aurea".
  const alvo = ESPECIES_FICTICIAS.find((e) => e.nome_cientifico === 'Ficticia aurea')!;
  const rotulos = PERGUNTAS_PADRAO.flatMap((p) => p.opcoes).filter((o) => alvo.opcoes.includes(o.chave)).map((o) => o.rotulo);
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('heading', { name: 'Qual destas é a árvore?' }).isVisible()) break;
    await expect(page.getByTestId('possiveis')).toBeVisible();
    const botoes = page.locator('.grade-opcoes .opcao');
    const textos = await botoes.allInnerTexts();
    const certo = textos.findIndex((t) => rotulos.includes(t.trim()));
    await botoes.nth(certo >= 0 ? certo : textos.length - 1).click();
  }
  await expect(page.getByRole('heading', { name: 'Qual destas é a árvore?' })).toBeVisible();
  await page.locator('.candidata', { hasText: 'Ipê-de-mentira' }).getByRole('button', { name: 'É esta' }).click();
  await page.getByRole('button', { name: 'Tenho certeza' }).click();
  await expect(page.getByTestId('resultado')).toHaveText('Ficticia aurea · certo');
});
