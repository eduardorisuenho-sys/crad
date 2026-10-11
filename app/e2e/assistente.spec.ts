import { expect, test } from '@playwright/test';
import { ESPECIES_FICTICIAS, PERGUNTAS_PADRAO } from '@crads/dominio';
import { entrarComoGestora } from './apoio';

test('assistente identifica uma espécie fictícia sem internet, uma pergunta por vez', async ({ page, context }) => {
  await entrarComoGestora(page);
  await context.setOffline(true);

  await page.getByRole('link', { name: 'Espécies' }).click();
  await page.getByText('Assistente de identificação').click();
  await page.getByRole('button', { name: 'Espécies fictícias de treino' }).click();
  await expect(page.getByText('5 espécie(s) fictícia(s) criada(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

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
