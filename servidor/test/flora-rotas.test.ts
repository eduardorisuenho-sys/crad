import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

describe.skipIf(!temPocketBase)('lista oficial de espécies: pedir ao servidor e acompanhar', () => {
  let s: ServidorTeste;
  let admin: { id: string; token: string };
  let coletor: { id: string; token: string };
  const pasta = join(__dirname, '..', 'pb_public', 'flora');

  beforeAll(async () => {
    rmSync(join(pasta, 'situacao.json'), { force: true });
    s = await subirServidor();
    admin = await criarUsuario(s, 'admin@flora.local', { gestor_geral: true });
    coletor = await criarUsuario(s, 'col@flora.local');
  });
  afterAll(() => {
    s?.parar();
    rmSync(join(pasta, 'situacao.json'), { force: true });
  });

  it('mostra a situação, só quem cuida das espécies pede, e o resultado (ou o erro) aparece', async () => {
    const r0 = await chamar(s, admin.token, 'GET', '/api/crads/flora/situacao');
    console.log('DEPURA', r0.status, JSON.stringify(r0.dados));
    expect(r0.dados).toMatchObject({ ok: false, erro: expect.stringMatching(/ainda não foi baixada/) });
    expect((await chamar(s, coletor.token, 'POST', '/api/crads/flora/atualizar')).status).toBe(403);
    expect((await chamar(s, admin.token, 'POST', '/api/crads/flora/atualizar')).status).toBe(202);
    // Este ambiente de teste não tem internet: o servidor roda o script e anota o motivo da falha.
    await expect
      .poll(async () => (await chamar(s, admin.token, 'GET', '/api/crads/flora/situacao')).dados, { timeout: 60_000, interval: 1000 })
      .toMatchObject({ ok: false, erro: expect.any(String), quando: expect.any(String) });
  }, 90_000);
});
