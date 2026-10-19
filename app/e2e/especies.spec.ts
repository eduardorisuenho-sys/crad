import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { entrarComoGestora, lerDoServidor } from './apoio';

const modelo = fileURLToPath(new URL('../../dados/modelo-especies.xlsx', import.meta.url));

test('gestora importa o modelo de planilha sem internet e as espécies sobem quando o sinal volta', async ({ page, context }) => {
  await entrarComoGestora(page);
  await context.setOffline(true);

  await page.getByRole('link', { name: 'Espécies' }).click();
  await page.getByRole('link', { name: 'Importar' }).click();
  await page.locator('input[type=file]').setInputFiles(modelo);
  const previa = page.getByTestId('previa');
  await expect(previa).toContainText('Espécies novas');
  await expect(previa.locator('dd').nth(2)).toHaveText('1');
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByText('1 espécies novas')).toBeVisible();
  await page.getByRole('button', { name: 'Ver espécies' }).click();

  await page.getByLabel('Buscar espécie').fill('arvore de exemplo');
  await expect(page.getByText('Árvore-de-exemplo')).toBeVisible();
  await expect(page.getByText('fictícia', { exact: true })).toHaveCount(0); // sem selo na lista

  await context.setOffline(false);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  // (outros testes rodam ao mesmo tempo no mesmo servidor: filtra pelo que este teste importou)
  const especies = (await lerDoServidor('especie')).filter((e) => e.fonte_cadastro === 'planilha');
  expect(especies).toEqual([expect.objectContaining({ nome_cientifico: 'Ficticia exemplaris Fulano', ficticia: true, publicada: false, meses_flor: [9, 10, 11] })]);
  expect((await lerDoServidor('nome_popular')).filter((n) => n.especie_id === especies[0].id).map((n) => n.nome)).toEqual(['Árvore-de-exemplo']);
});

test('nova espécie já com vários nomes populares', async ({ page }) => {
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto('/especies/nova');
  const nomes = page.getByTestId('nomes-populares');
  await nomes.getByLabel('Novo nome popular').fill('Árvore-teste-um, Árvore-teste-dois');
  await nomes.getByRole('button', { name: 'Incluir' }).click();
  await nomes.getByLabel('Novo nome popular').fill('árvore-teste-um'); // repetido: não entra de novo
  await nomes.getByRole('button', { name: 'Incluir' }).click();
  await nomes.getByLabel('Novo nome popular').fill('Árvore-teste-três');
  await page.getByLabel('Nome científico').fill('Testia multinomia');
  await page.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect(page).toHaveURL(/\/especies\/[a-z0-9]{15}$/);
  const chips = page.getByTestId('nomes-populares').locator('.chip');
  await expect(chips).toHaveCount(3);
  for (const n of ['Árvore-teste-um', 'Árvore-teste-dois', 'Árvore-teste-três']) await expect(chips.filter({ hasText: n })).toHaveCount(1);
  await expect.poll(async () => (await lerDoServidor('nome_popular')).filter((n) => String(n.nome).startsWith('Árvore-teste-')).length, { timeout: 20_000 }).toBe(3);
});

test('gestora baixa a lista oficial de espécies pelo servidor e vê a prévia antes de gravar', async ({ page }) => {
  const { strToU8, zipSync } = await import('fflate');
  // Pacote FICTÍCIO no formato do JBRJ (o servidor de verdade baixa o oficial).
  const meta = `<?xml version="1.0"?><archive xmlns="http://rs.tdwg.org/dwc/text/">
  <core fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Taxon"><files><location>taxon.txt</location></files><id index="0"/>
  <field index="1" term="http://rs.tdwg.org/dwc/terms/scientificName"/><field index="2" term="http://rs.tdwg.org/dwc/terms/family"/>
  <field index="3" term="http://rs.tdwg.org/dwc/terms/taxonRank"/><field index="4" term="http://rs.tdwg.org/dwc/terms/taxonomicStatus"/></core>
  <extension fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/VernacularName"><files><location>v.txt</location></files><coreid index="0"/>
  <field index="1" term="http://rs.tdwg.org/dwc/terms/vernacularName"/><field index="2" term="http://purl.org/dc/terms/language"/></extension>
  <extension fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/Distribution"><files><location>d.txt</location></files><coreid index="0"/>
  <field index="1" term="http://rs.tdwg.org/dwc/terms/locationID"/></extension>
  <extension fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/SpeciesProfile"><files><location>p.txt</location></files><coreid index="0"/>
  <field index="1" term="http://rs.gbif.org/terms/1.0/lifeForm"/></extension></archive>`;
  const zip = zipSync({
    'meta.xml': strToU8(meta),
    'taxon.txt': strToU8('id\tn\tf\tr\ts\n77\tOficialia teste\tTestaceae\tESPECIE\tNOME_ACEITO\n'),
    'v.txt': strToU8('id\tv\tl\n77\tárvore-oficial-teste\tPORTUGUES\n'),
    'd.txt': strToU8('id\tl\n77\tBR-TO\n'),
    'p.txt': strToU8('id\tf\n77\t{"lifeForm":["Árvore"]}\n'),
  });
  await page.route('**/flora/flora-TO.zip', (r) => r.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from(zip) }));
  await entrarComoGestora(page);
  await page.goto('/especies/importar');
  await page.getByRole('button', { name: 'Baixar a lista oficial pelo servidor' }).click();
  const previa = page.locator('.ficha', { hasText: 'Espécies novas de TO' });
  await expect(previa).toBeVisible();
  await expect(previa.locator('dd').first()).toHaveText('1');
});

test('sem a lista no servidor, o app mostra o motivo e pede para baixar agora', async ({ page }) => {
  await page.route('**/flora/flora-TO.zip', (r) => r.fulfill({ status: 404, body: 'File not found.' }));
  await page.route('**/api/crads/flora/situacao', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, erro: 'URLError: sem conexão com o site do JBRJ' }) }));
  await entrarComoGestora(page);
  await page.goto('/especies/importar');
  await page.getByRole('button', { name: 'Baixar a lista oficial pelo servidor' }).click();
  await expect(page.getByTestId('situacao-flora')).toContainText('Motivo: URLError: sem conexão com o site do JBRJ');
  // pede de novo: o servidor de teste roda o script de verdade (aqui sem internet, então anota o erro)
  await page.unroute('**/api/crads/flora/situacao');
  await page.getByRole('button', { name: 'Pedir ao servidor para baixar agora' }).click();
  await expect(page.getByTestId('situacao-flora')).toContainText('baixando');
  await expect(page.getByTestId('situacao-flora')).toContainText('Motivo:', { timeout: 30_000 });
});

test('nova espécie só com o nome popular: o app completa nome científico e família pela Wikipédia', async ({ page, context }) => {
  // Wikipédia e Wikidata de mentira (o teste não sai para a internet)
  await context.route('https://pt.wikipedia.org/**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ query: { pages: { '1': { title: 'Árvore-wiki-teste', extract: 'É uma árvore nativa do Cerrado.', pageprops: { wikibase_item: 'Q901' } } } } }) }),
  );
  const arvore: Record<string, Record<string, unknown>> = {
    Q901: { P225: 'Wikiana testea', P105: 'Q7432', P171: 'Q902' },
    Q902: { P225: 'Wikiana', P105: 'Q34740', P171: 'Q903' },
    Q903: { P225: 'Testaceae', P105: 'Q35409', P171: 'Q25314' },
    Q25314: { P225: 'Angiospermae' },
  };
  await context.route('https://www.wikidata.org/**', (r) => {
    const id = new URL(r.request().url()).searchParams.get('ids')!;
    const e = arvore[id] ?? {};
    const claims: Record<string, unknown[]> = {};
    for (const [p, v] of Object.entries(e)) claims[p] = [{ mainsnak: { datavalue: { value: p === 'P225' ? v : { id: v } } } }];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ entities: { [id]: { claims } } }) });
  });
  await entrarComoGestora(page);
  await expect(page.getByTestId('barra-sync')).toContainText('Tudo enviado', { timeout: 15_000 });
  await page.goto('/especies/nova');
  await expect(page.getByRole('heading', { name: 'Referência' })).toHaveCount(0); // sem referências na espécie nova
  await expect(page.getByTestId('dica-wikipedia')).toContainText('Só o nome popular é obrigatório');
  // sem nome popular não salva
  await page.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect(page.getByText('Escreva pelo menos um nome popular.')).toBeVisible();
  await page.getByTestId('nomes-populares').getByLabel('Novo nome popular').fill('Árvore-wiki-teste');
  await page.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect(page).toHaveURL(/\/especies\/[a-z0-9]{10,}/);
  await expect(page.getByLabel('Nome científico')).toHaveValue('Wikiana testea', { timeout: 20_000 });
  await expect(page.getByLabel('Família')).toHaveValue('Testaceae');
  await expect(page.getByText(/Revisar: Nome científico e família preenchidos pela Wikipédia \(https:\/\/pt\.wikipedia\.org\/wiki\//)).toBeVisible();
  await expect.poll(async () => (await lerDoServidor('especie')).find((e) => e.nome_cientifico === 'Wikiana testea')?.familia, { timeout: 20_000 }).toBe('Testaceae');
});
