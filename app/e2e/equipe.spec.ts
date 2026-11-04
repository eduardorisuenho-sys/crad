import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

const admin = { 'content-type': 'application/json', authorization: process.env.CRADS_PB_ADMIN! };

test('coletor cria a conta pelo celular, a gestora aprova e libera "semear" na tabela de permissões', async ({ browser }) => {
  const sufixo = Date.now().toString(36);
  const email = `novo.coletor.${sufixo}@teste.local`;
  // ---- a pessoa cria a conta
  const cc = await browser.newContext();
  const c = await cc.newPage();
  await c.goto('/');
  await c.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await c.getByRole('link', { name: 'Criar conta' }).click();
  await expect(c.getByRole('button', { name: /Grupo Gestor/ })).toContainText('Precisa da aprovação de um gestor ou do administrador');
  await c.getByRole('button', { name: /Vou coletar sementes/ }).click();
  // Com um viveiro só, ele já vem escolhido; com vários, a pessoa marca o dela e continua.
  const botaoViveiro = c.getByRole('button', { name: 'Viveiro Teste' });
  await expect(botaoViveiro.or(c.getByText('Vou coletar sementes · Viveiro Teste'))).toBeVisible();
  if (await botaoViveiro.isVisible()) {
    await botaoViveiro.click();
    await c.getByRole('button', { name: /^Continuar \(1 viveiro\)/ }).click();
  }
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

test('a pessoa pede acesso a mais de um viveiro; a gestora cadastra em todos de uma vez', async ({ browser }) => {
  // um segundo viveiro
  await fetch(`${PB()}/api/collections/viveiro/records`, { method: 'POST', headers: admin, body: JSON.stringify({ id: 'vivteste0000002', sigla: 'SEG', nome: 'Viveiro Dois', ativo: true }) });
  const sufixo = Date.now().toString(36);
  const email = `dois.viveiros.${sufixo}@teste.local`;
  const cc = await browser.newContext();
  const c = await cc.newPage();
  await c.goto('/');
  await c.evaluate((url) => localStorage.setItem('crads_servidor', url), PB());
  await c.getByRole('link', { name: 'Criar conta' }).click();
  await c.getByRole('button', { name: /Vou trabalhar no viveiro/ }).click();
  await expect(c.getByText('Em quais viveiros?')).toBeVisible();
  const continuar = c.getByRole('button', { name: /^Continuar/ });
  await expect(continuar).toBeDisabled();
  await c.getByRole('button', { name: 'Viveiro Teste' }).click();
  await c.getByRole('button', { name: 'Viveiro Dois' }).click();
  await expect(c.getByRole('button', { name: 'Viveiro Dois' })).toHaveAttribute('aria-pressed', 'true');
  await expect(continuar).toHaveText('Continuar (2 viveiros)');
  await continuar.click();
  await expect(c.getByText(/Vou trabalhar no viveiro · .*Viveiro Teste/)).toContainText('Viveiro Dois');
  await c.getByLabel('Nome completo').fill('Dois Viveiros');
  await c.getByLabel('E-mail').fill(email);
  await c.getByLabel(/^Senha/).fill('senha-nova-123');
  await c.getByRole('button', { name: 'Criar conta' }).click();
  // a espera cita os dois viveiros; um pedido em cada
  await expect(c.getByTestId('aguardando-acesso')).toContainText('Viveiro Teste');
  await expect(c.getByTestId('aguardando-acesso')).toContainText('Viveiro Dois');
  expect((await lerDoServidor('pedido_acesso')).filter((p) => p.email === email).map((p) => p.viveiro_id).sort()).toEqual(['vivteste0000001', 'vivteste0000002']);
  await cc.close();

  // a gestora (administradora) cadastra alguém em todos os viveiros
  const cg = await browser.newContext();
  const g = await cg.newPage();
  await entrarComoGestora(g);
  await g.goto('/equipe');
  await g.getByRole('button', { name: /Cadastrar pessoa/ }).click();
  await g.getByLabel('Nome completo').fill('Coletor de Todos');
  const emailTodos = `todos.${sufixo}@teste.local`;
  await g.getByLabel('E-mail').fill(emailTodos);
  await g.getByLabel(/Senha/).fill('senha-todos-123');
  await g.getByRole('group', { name: 'Viveiros (um ou mais)' }).getByRole('button', { name: 'Todos' }).click();
  await g.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(g.getByText('Coletor de Todos foi cadastrado(a).', { exact: false })).toBeVisible();
  const u = (await lerDoServidor('users')).find((x) => x.email === emailTodos)!;
  const viveiros = (await lerDoServidor('viveiro')).filter((v) => v.ativo !== false && !v.excluido).map((v) => v.id).sort();
  await expect
    .poll(async () => (await lerDoServidor('usuario_viveiro')).filter((v) => v.usuario_id === u.id && !v.excluido).map((v) => v.viveiro_id).sort())
    .toEqual(viveiros);
  await cg.close();
});

// o segundo viveiro é só deste arquivo: com dois, a administradora teria de escolher o viveiro ao entrar nos outros testes
test.afterAll(async () => {
  await fetch(`${PB()}/api/collections/viveiro/records/vivteste0000002`, { method: 'PATCH', headers: admin, body: JSON.stringify({ excluido: true, ativo: false }) });
});
