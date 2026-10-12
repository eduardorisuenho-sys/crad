import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

test('coletor cria a conta pelo celular, a gestora aprova e libera "semear" na tabela de permissões', async ({ browser }) => {
  const sufixo = Date.now().toString(36);
  const email = `novo.coletor.${sufixo}@teste.local`;
  // ---- a pessoa cria a conta
  const cc = await browser.newContext();
  const c = await cc.newPage();
  await c.goto('/');
  await c.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await c.getByRole('link', { name: 'Criar conta' }).click();
  await c.getByRole('button', { name: /Vou coletar sementes/ }).click();
  // Com um viveiro só, ele já vem escolhido; com vários, a pessoa toca no dela.
  const botaoViveiro = c.getByRole('button', { name: 'Viveiro Teste' });
  await expect(botaoViveiro.or(c.getByText('Vou coletar sementes · Viveiro Teste'))).toBeVisible();
  if (await botaoViveiro.isVisible()) await botaoViveiro.click();
  await expect(c.getByText('Vou coletar sementes · Viveiro Teste')).toBeVisible();
  await c.getByLabel('Nome completo').fill('Novo Coletor');
  await c.getByLabel('E-mail').fill(email);
  await c.getByLabel(/^Senha/).fill('senha-nova-123');
  await c.getByRole('button', { name: 'Criar conta' }).click();
  await expect(c.getByTestId('aguardando-acesso')).toContainText('coletor');
  await expect(c.getByTestId('aguardando-acesso')).toContainText('Viveiro Teste');
  await expect(c.locator('.grade-blocos').getByRole('link', { name: 'Matrizes' })).toHaveCount(0);

  // ---- a gestora aprova
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await g.goto('/equipe');
  const pedido = g.locator('.pedido-acesso', { hasText: email });
  await expect(pedido).toContainText('quer ser Coletor');
  await pedido.getByRole('button', { name: 'Aprovar' }).click();
  await expect(g.getByText('Novo Coletor agora faz parte da equipe.')).toBeVisible();
  await expect(g.getByTestId('pessoas')).toContainText(email);

  // ---- o coletor já vê os módulos da equipe (o app confere sozinho; o botão adianta)
  const verificar = c.getByRole('button', { name: 'Verificar agora' });
  if (await verificar.isVisible()) await verificar.click();
  await expect(c.locator('.grade-blocos').getByRole('link', { name: 'Matrizes', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(c.locator('.grade-blocos').getByRole('link', { name: 'Viveiro', exact: true })).toHaveCount(0);

  // ---- tabela de permissões: a gestora (administradora) deixa o coletor semear
  await g.goto('/permissoes');
  // No celular, um perfil por vez.
  const lista = g.getByTestId('permissoes');
  await g.getByRole('group', { name: 'Perfil' }).getByRole('button', { name: 'Solicitante' }).click();
  await expect(lista.getByLabel('Pedir mudas')).toBeChecked();
  await expect(lista.getByLabel('Semear e cuidar das mudas')).toBeDisabled();
  await g.getByRole('group', { name: 'Perfil' }).getByRole('button', { name: 'Coletor' }).click();
  await expect(lista.getByLabel('Ver CPF e telefone (LGPD)')).toBeDisabled();
  await lista.getByLabel('Semear e cuidar das mudas').check();
  await g.getByRole('button', { name: 'Salvar permissões' }).click();
  await expect(g.getByText('Permissões salvas.')).toBeVisible();
  await expect
    .poll(async () => ((await lerDoServidor('parametro')).find((p) => p.chave === 'permissoes')?.valor as Record<string, string[]> | undefined)?.producao ?? [], { timeout: 20_000 })
    .toContain('coletor');

  await c.goto('/configuracoes');
  await c.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(c.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await c.goto('/');
  await expect(c.locator('.grade-blocos').getByRole('link', { name: 'Viveiro', exact: true })).toBeVisible({ timeout: 15_000 });
  await cc.close();
  await cg.close();
});

test('solicitante cria a conta e já pode pedir mudas', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await page.getByRole('link', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: /Quero pedir mudas/ }).click();
  await page.getByLabel('Nome completo').fill('Produtora Nova');
  await page.getByLabel('E-mail').fill(`produtora.${Date.now().toString(36)}@teste.local`);
  await page.getByLabel(/^Senha/).fill('senha-curta');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Produtora' })).toBeVisible();
  await expect(page.locator('.grade-blocos').getByRole('link', { name: 'Doação de mudas' })).toBeVisible();
  await expect(page.getByTestId('aguardando-acesso')).toHaveCount(0);
});

test('no computador, a tabela mostra todos os perfis lado a lado e só o administrador muda', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const g = await ctx.newPage();
  await entrarComoGestora(g);
  await g.goto('/permissoes');
  const tabela = g.getByTestId('permissoes');
  await expect(tabela.getByRole('columnheader')).toHaveText(['O que fazer', 'Administrador', 'Grupo gestor', 'Viveirista', 'Coletor', 'Solicitante']);
  await expect(tabela.getByLabel('Ver CPF e telefone (LGPD): Coletor')).toBeDisabled();
  await expect(tabela.getByLabel('Aprovar pedidos de mudas: Grupo gestor')).toBeChecked();
  await expect(tabela.getByLabel('Aprovar pedidos de mudas: Viveirista')).toBeEnabled();
  await ctx.close();
});
