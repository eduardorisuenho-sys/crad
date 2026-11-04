import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor, PB } from './apoio';

const admin = { 'content-type': 'application/json', authorization: process.env.CRADS_PB_ADMIN! };
const criar = async (col: string, dados: object) => (await (await fetch(`${PB()}/api/collections/${col}/records`, { method: 'POST', headers: admin, body: JSON.stringify(dados) })).json()) as { id: string };

test('excluir a matriz leva junto a coleta e o lote de sementes que veio dela, de uma vez', async ({ page }) => {
  // matriz com uma coleta; o servidor forma o lote de sementes sozinho
  const especie = (await lerDoServidor('especie')).find((e) => e.nome_cientifico === 'Ficticia campestris')!;
  const m = await criar('matriz', { codigo: 'MT-9300', especie_id: especie.id, grau_certeza: 'certo', situacao: 'ativa', situacao_validacao: 'aprovada', lat: -10.2, lon: -48.3, viveiro_id: 'vivteste0000001' });
  const c = await criar('coleta', { matriz_id: m.id, data: '2026-11-04', quantidade: 2, unidade: 'kg', material: 'semente', viveiro_id: 'vivteste0000001' });
  await expect.poll(async () => (await lerDoServidor('lote_sementes_coleta')).find((j) => j.coleta_id === c.id)?.lote_sementes_id, { timeout: 20_000 }).toBeTruthy();
  const idLote = (await lerDoServidor('lote_sementes_coleta')).find((j) => j.coleta_id === c.id)!.lote_sementes_id as string;
  const codigoLote = String((await lerDoServidor('lote_sementes')).find((l) => l.id === idLote)!.codigo);

  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 20_000 });
  await page.goto(`/matrizes/${m.id}`);
  let pergunta = '';
  page.once('dialog', (d) => {
    pergunta = d.message();
    void d.accept();
  });
  await page.getByRole('button', { name: /Excluir \(preenchido errado\)/ }).click();
  await expect(page).toHaveURL(/\/matrizes$/);
  expect(pergunta).toContain('Excluir MT-9300 e o que foi feito a partir dele?');
  expect(pergunta).toContain(`1 lote de sementes (${codigoLote})`);
  expect(pergunta).toContain('1 coleta (Coleta de 04/11/2026)');

  // tudo foi para a lixeira (o administrador pode restaurar)
  await expect
    .poll(
      async () => [
        (await lerDoServidor('matriz')).find((x) => x.id === m.id)?.excluido,
        (await lerDoServidor('coleta')).find((x) => x.id === c.id)?.excluido,
        (await lerDoServidor('lote_sementes')).find((x) => x.id === idLote)?.excluido,
      ],
      { timeout: 20_000 },
    )
    .toEqual([true, true, true]);
});
