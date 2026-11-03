import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error módulo JS do carteiro (roda no servidor com Node)
import { carregarChaves, enviar, iniciar } from '../push/push.mjs';
// @ts-expect-error dependência do carteiro
import webpush from '../push/node_modules/web-push/src/index.js';

describe('carteiro de avisos (Web Push)', () => {
  it('cria as chaves uma vez e publica só a chave pública', () => {
    const dir = mkdtempSync(join(tmpdir(), 'push-'));
    const a = carregarChaves(join(dir, 'vapid.json'), join(dir, 'publico', 'chave.json'));
    const b = carregarChaves(join(dir, 'vapid.json'), join(dir, 'publico', 'chave.json'));
    expect(b).toEqual(a);
    const publico = JSON.parse(readFileSync(join(dir, 'publico', 'chave.json'), 'utf8'));
    expect(publico).toEqual({ publicKey: a.publicKey });
    expect(JSON.stringify(publico)).not.toContain(a.privateKey);
  });

  it('entrega título, texto e tela; inscrição cancelada (410) volta como morta', async () => {
    const chamadas: unknown[] = [];
    const spy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub: { endpoint: string }, dados: string) => {
      chamadas.push([sub.endpoint, JSON.parse(dados)]);
      if (sub.endpoint.endsWith('/morta')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      return { statusCode: 201 };
    });
    const insc = (e: string) => ({ endpoint: e, keys: { p256dh: 'x', auth: 'y' } });
    const r = await enviar(
      [
        { inscricao: insc('https://push/ok'), titulo: 'Novo pedido de mudas', texto: 'DO-1', rota: '/doacao/1' },
        { inscricao: insc('https://push/morta'), titulo: 'Novo pedido de mudas', texto: 'DO-1', rota: '/doacao/1' },
      ],
      { publicKey: 'p', privateKey: 'q' },
    );
    expect(r).toEqual({ enviados: 1, mortas: ['https://push/morta'] });
    expect(chamadas[0]).toEqual(['https://push/ok', { titulo: 'Novo pedido de mudas', texto: 'DO-1', rota: '/doacao/1' }]);
    spy.mockRestore();
  });

  it('aviso de teste: responde na hora e entrega depois do atraso', async () => {
    const entregues: string[] = [];
    const spy = vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub: { endpoint: string }) => {
      entregues.push(sub.endpoint);
      return { statusCode: 201 };
    });
    const srv = iniciar(0, { publicKey: 'p', privateKey: 'q' });
    await new Promise((ok) => srv.once('listening', ok));
    const porta = (srv.address() as { port: number }).port;
    const envios = [{ inscricao: { endpoint: 'https://push/teste', keys: { p256dh: 'x', auth: 'y' } }, titulo: 'Teste', texto: 't', rota: '/' }];
    const r = await fetch(`http://127.0.0.1:${porta}/enviar`, { method: 'POST', body: JSON.stringify({ envios, atraso: 1 }) });
    expect(await r.json()).toEqual({ agendados: 1, atraso: 1 });
    expect(entregues).toEqual([]);
    await vi.waitFor(() => expect(entregues).toEqual(['https://push/teste']), { timeout: 3000 });
    srv.close();
    spy.mockRestore();
  });
});
