import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chamar, criarUsuario, subirServidor, temPocketBase, type ServidorTeste } from './servidor';

describe.skipIf(!temPocketBase)('Manual do viveirista', () => {
  let s: ServidorTeste;
  beforeAll(async () => {
    s = await subirServidor();
  });
  afterAll(() => s?.parar());

  it('o manual do pequi já vem com o servidor, com o PDF, e quem entrou baixa', async () => {
    const lista = (await chamar(s, s.admin, 'GET', '/api/collections/manual/records')).dados.items;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'manualpequiga03', titulo: 'Germinação de Pequi', assunto: 'germinacao', excluido: false });
    expect(lista[0].arquivo).toMatch(/\.pdf$/);
    // qualquer pessoa com conta (até quem só pede mudas) lê o manual
    const u = await criarUsuario(s, 'leitor@manual.local', { solicitante: true });
    const r = await fetch(`${s.url}/api/crads/arquivo/manual/manualpequiga03/arquivo`, { headers: { authorization: u.token } });
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    // sem login, não
    expect((await fetch(`${s.url}/api/crads/arquivo/manual/manualpequiga03/arquivo`)).status).toBeGreaterThanOrEqual(400);
    // e chega aos aparelhos pela sincronização
    const sync = (await chamar(s, u.token, 'GET', '/api/crads/sync/receber?desde=0&limite=500')).dados;
    expect(JSON.stringify(sync)).toContain('manualpequiga03');
  });
});
