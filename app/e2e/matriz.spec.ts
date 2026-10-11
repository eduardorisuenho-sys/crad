import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoColetor, lerDoServidor } from './apoio';

const foto = fileURLToPath(new URL('./fixtures/foto.jpg', import.meta.url));
const ARVORE = { latitude: -10.1844, longitude: -48.3336, accuracy: 6 };

test.use({ permissions: ['geolocation'], geolocation: ARVORE });

test('coletor cadastra matriz em campo sem internet, com GPS, fotos, plaqueta e alerta de diversidade', async ({ page, context }) => {
  await entrarComoColetor(page);
  // Antes de sair: reserva os códigos do aparelho.
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Preparar para ir a campo' }).click();
  await expect(page.getByText('Pronto para ir a campo.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();

  await context.setOffline(true);
  await page.getByRole('link', { name: 'Matrizes' }).click();
  await page.getByRole('link', { name: 'Cadastrar matriz' }).click();

  // 1. GPS
  await expect(page.getByTestId('gps')).toContainText('±6 m');
  await page.getByRole('button', { name: 'Usar este ponto' }).click();
  // 2. Espécie pelo nome (sem acento e incompleto)
  await page.getByRole('button', { name: 'Já sei o nome' }).click();
  await page.getByLabel('Nome da espécie').fill('arvore de campo');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await page.getByRole('button', { name: 'Tenho certeza' }).click();
  // 3. Fotos (árvore e folha são obrigatórias)
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  await page.locator('label', { hasText: 'Árvore inteira' }).locator('input').setInputFiles(foto);
  await page.locator('label', { hasText: 'Folhas' }).locator('input').setInputFiles(foto);
  await expect(page.locator('label.opcao.ativa')).toHaveCount(2);
  await page.getByRole('button', { name: 'Continuar' }).click();
  // 4. Árvore
  await page.getByLabel('Altura (metros, aproximada)').fill('14');
  await page.getByLabel('DAP (centímetros)').fill('38');
  await page.getByRole('button', { name: 'Boa, saudável' }).click();
  await page.getByRole('button', { name: 'Mata' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  // 5. Proprietário (telefone só o gestor vê)
  await page.getByLabel('Nome').fill('Proprietária Fictícia');
  await page.getByLabel('Telefone').fill('63 90000-0001');
  await page.getByLabel('O dono autorizou a entrada e a coleta').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  // 6. Salvar: código definitivo da faixa reservada, mesmo sem internet
  await page.getByRole('button', { name: 'Salvar matriz' }).click();
  await expect(page.getByTestId('matriz-salva')).toContainText('salva no aparelho');
  const codigo = (await page.locator('.codigo-grande').innerText()).trim();
  expect(codigo).toMatch(/^MT-\d{4}$/);
  await expect(page.getByTestId('plaqueta').locator('svg')).toBeVisible();

  // Fenologia da visita
  await page.getByRole('button', { name: 'Flor', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar visita' }).click();
  await expect(page.getByText('Fenologia registrada.')).toBeVisible();

  // Segunda matriz da mesma espécie a poucos metros: alerta de diversidade genética
  await context.setGeolocation({ ...ARVORE, latitude: ARVORE.latitude + 0.0003 });
  await page.goto('/matrizes/nova');
  await page.getByRole('button', { name: 'Usar este ponto' }).click();
  await page.getByRole('button', { name: 'Já sei o nome' }).click();
  await page.getByLabel('Nome da espécie').fill('arvore de campo');
  await page.getByRole('button', { name: /Árvore-de-campo-fictícia/ }).click();
  await page.getByRole('button', { name: 'Tenho certeza' }).click();
  await expect(page.getByText('Já existe matriz desta espécie perto daqui')).toBeVisible();
  await expect(page.getByText(`${codigo}`)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar cadastro' }).click();

  // Abrir pela plaqueta (digitando o código, já que o teste não tem câmera)
  await page.goto('/ler-qr');
  await page.getByLabel('Código da plaqueta').fill(codigo.toLowerCase());
  await page.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByRole('heading', { name: `Matriz ${codigo}` })).toBeVisible();

  // Sinal de volta: tudo vai para o servidor
  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  const [m] = (await lerDoServidor('matriz')).filter((x) => x.codigo === codigo);
  expect(m).toMatchObject({ grau_certeza: 'certo', metodo_identificacao: 'manual', altura_m: 14, dap_cm: 38, lat: ARVORE.latitude, situacao_validacao: 'pendente', autorizacao_proprietario: true });
  const fotos = (await lerDoServidor('foto')).filter((f) => f.registro_id === m.id);
  expect(fotos.map((f) => f.parte).sort()).toEqual(['arvore', 'folha']);
  expect(fotos.every((f) => String(f.arquivo).endsWith('.jpg') && String(f.miniatura).endsWith('.jpg'))).toBe(true);
  expect((await lerDoServidor('dados_pessoais')).some((d) => d.telefone === '63 90000-0001')).toBe(true);
  expect((await lerDoServidor('fenologia')).filter((f) => f.matriz_id === m.id)).toEqual([expect.objectContaining({ fases: ['flor'] })]);
});
