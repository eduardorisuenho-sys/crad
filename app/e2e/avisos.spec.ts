import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

test('com a notificação permitida, o aparelho se inscreve para receber avisos com o app fechado', async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ['notifications'] });
  // O navegador de teste não fala com o serviço de push do Google: simula a inscrição.
  await ctx.addInitScript(() => {
    const falsa = { endpoint: 'https://push.exemplo/aparelho-teste', toJSON: () => ({ endpoint: 'https://push.exemplo/aparelho-teste', keys: { p256dh: 'chave-p', auth: 'chave-a' } }), unsubscribe: async () => true };
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
  await ctx.close();
});
