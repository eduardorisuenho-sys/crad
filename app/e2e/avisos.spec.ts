import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

test('com a notificação permitida, o aparelho se inscreve para receber avisos com o app fechado', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['notifications'] });
  // O navegador de teste não fala com o serviço de push do Google: simula a inscrição.
  await ctx.addInitScript(() => {
    const falsa = { endpoint: 'https://push.exemplo/aparelho-teste', toJSON: () => ({ endpoint: 'https://push.exemplo/aparelho-teste', keys: { p256dh: 'chave-p', auth: 'chave-a' } }), unsubscribe: async () => true };
    // e a permissão já dada (no navegador do GitHub ela fica "default" mesmo com a permissão do contexto)
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
    }
    if (typeof PushManager !== 'undefined') {
      PushManager.prototype.getSubscription = async () => null;
      PushManager.prototype.subscribe = async () => falsa as unknown as PushSubscription;
    }
  });
  await ctx.route('**/push/chave.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' }) }));
  const page = await ctx.newPage();
  await entrarComoGestora(page);
  await page.goto('/configuracoes');
  await expect(page.getByTestId('avisos-fechado')).toContainText('mesmo com o app fechado', { timeout: 15_000 });
  await expect.poll(async () => (await lerDoServidor('inscricao_push')).map((i) => i.endpoint)).toContain('https://push.exemplo/aparelho-teste');

  // Aviso de teste: o servidor de testes não tem o carteiro rodando, e o app diz isso
  await page.getByTestId('testar-aviso').click();
  await expect(page.getByTestId('resultado-teste')).toContainText('carteiro de avisos está parado');
  await ctx.close();
});

test('a tela inicial pede para ligar os avisos com som; "Agora não" esconde', async ({ page }) => {
  // aparelho que ainda não respondeu à permissão (no navegador do GitHub ela começa bloqueada)
  await page.addInitScript(() => {
    if (typeof Notification !== 'undefined') Object.defineProperty(Notification, 'permission', { get: () => 'default' });
  });
  await entrarComoGestora(page);
  const cartao = page.getByTestId('ligar-avisos');
  await expect(cartao).toContainText('o celular toca mesmo com o app fechado e a tela apagada');
  await cartao.getByRole('button', { name: 'Agora não' }).click();
  await expect(cartao).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Gestora' })).toBeVisible();
  await expect(page.getByTestId('ligar-avisos')).toHaveCount(0);
});
