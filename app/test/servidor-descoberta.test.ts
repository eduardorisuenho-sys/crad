import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const memoria = new Map<string, string>();
beforeEach(() => {
  memoria.clear();
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => memoria.set(k, v), removeItem: (k: string) => memoria.delete(k) });
  // app publicado (não é o computador local)
  vi.stubGlobal('location', { hostname: 'crad.exemplo.workers.dev', origin: 'https://crad.exemplo.workers.dev' });
});
afterEach(() => vi.unstubAllGlobals());

const json = () => new Response('{"code":200}', { status: 200, headers: { 'content-type': 'application/json' } });

describe('o app acha o servidor sozinho (sem campo de endereço)', () => {
  it('publicação com endereço errado: tenta o servidor do piloto e guarda o que respondeu', async () => {
    const { descobrirServidor, SERVIDOR_PILOTO, servidorGuardado } = await import('../src/dados/sessao');
    const tentados: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      tentados.push(url);
      if (url.startsWith(SERVIDOR_PILOTO)) return json();
      // endereço errado: a página do app em vez dos dados
      return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    });
    expect(await descobrirServidor()).toBe(SERVIDOR_PILOTO);
    expect(tentados.at(-1)).toBe(`${SERVIDOR_PILOTO}/api/health`);
    expect(servidorGuardado()).toBe(SERVIDOR_PILOTO);
  });

  it('o que já funcionou no aparelho vem primeiro', async () => {
    memoria.set('crads_servidor', 'https://outro.servidor.exemplo');
    const { descobrirServidor } = await import('../src/dados/sessao');
    const tentados: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      tentados.push(url);
      return json();
    });
    expect(await descobrirServidor()).toBe('https://outro.servidor.exemplo');
    expect(tentados).toEqual(['https://outro.servidor.exemplo/api/health']);
  });

  it('sem internet: devolve o primeiro e tenta de novo depois', async () => {
    const { descobrirServidor, servidoresCandidatos } = await import('../src/dados/sessao');
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('sem rede');
    });
    expect(await descobrirServidor()).toBe(servidoresCandidatos()[0]);
    let chamadas = 0;
    vi.stubGlobal('fetch', async () => {
      chamadas++;
      return json();
    });
    await descobrirServidor();
    expect(chamadas).toBe(1);
  });
});
