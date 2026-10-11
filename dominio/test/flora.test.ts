import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { especiesDaFlora, FORMAS_VIDA_PADRAO, lerDwca, planejarFlora } from '../src/especies/flora';

// Pacote Darwin Core FICTÍCIO, no formato do IPT do JBRJ (meta.xml + arquivos com cabeçalho).
const meta = `<?xml version="1.0"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/">
  <core encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Taxon">
    <files><location>taxon.txt</location></files>
    <id index="0"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/taxonID"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/acceptedNameUsageID"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/scientificName"/>
    <field index="4" term="http://rs.tdwg.org/dwc/terms/family"/>
    <field index="5" term="http://rs.tdwg.org/dwc/terms/taxonRank"/>
    <field index="6" term="http://rs.tdwg.org/dwc/terms/scientificNameAuthorship"/>
    <field index="7" term="http://rs.tdwg.org/dwc/terms/taxonomicStatus"/>
  </core>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/VernacularName">
    <files><location>vernacularname.txt</location></files>
    <coreid index="0"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/vernacularName"/>
    <field index="2" term="http://purl.org/dc/terms/language"/>
  </extension>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/Distribution">
    <files><location>distribution.txt</location></files>
    <coreid index="0"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/locationID"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/establishmentMeans"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/occurrenceRemarks"/>
  </extension>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/SpeciesProfile">
    <files><location>speciesprofile.txt</location></files>
    <coreid index="0"/>
    <field index="1" term="http://rs.gbif.org/terms/1.0/lifeForm"/>
  </extension>
</archive>`;

const tsv = (linhas: string[][]) => linhas.map((l) => l.join('\t')).join('\n');
const pacote = zipSync({
  'meta.xml': strToU8(meta),
  'taxon.txt': strToU8(
    tsv([
      ['id', 'taxonID', 'acceptedNameUsageID', 'scientificName', 'family', 'taxonRank', 'scientificNameAuthorship', 'taxonomicStatus'],
      ['1', '1', '', 'Ficticia alba Fulano', 'Ficticiaceae', 'ESPECIE', 'Fulano', 'NOME_ACEITO'],
      ['2', '2', '1', 'Velhonome albus Beltrano', 'Ficticiaceae', 'ESPECIE', 'Beltrano', 'SINONIMO'],
      ['3', '3', '', 'Ficticia herbacea Sicrano', 'Ficticiaceae', 'ESPECIE', 'Sicrano', 'NOME_ACEITO'],
      ['4', '4', '', 'Ficticia baiana Sicrano', 'Ficticiaceae', 'ESPECIE', 'Sicrano', 'NOME_ACEITO'],
      ['5', '5', '', 'Palmeira ficticia Fulano', 'Arecaceae', 'ESPECIE', 'Fulano', 'NOME_ACEITO'],
    ]),
  ),
  'vernacularname.txt': strToU8(tsv([['id', 'vernacularName', 'language'], ['1', 'árvore-branca', 'PORTUGUES'], ['1', 'white tree', 'INGLES'], ['5', 'palmeirinha', 'PORTUGUES']])),
  'distribution.txt': strToU8(
    tsv([
      ['id', 'locationID', 'establishmentMeans', 'occurrenceRemarks'],
      ['1', 'BR-TO', 'NATIVA', '{"endemism":"Endemica","phytogeographicDomain":["Cerrado","Amazônia"]}'],
      ['3', 'BR-TO', 'NATIVA', '{"phytogeographicDomain":["Cerrado"]}'],
      ['4', 'BR-BA', 'NATIVA', '{"phytogeographicDomain":["Caatinga"]}'],
      ['5', 'BR-TO', 'CULTIVADA', '{"phytogeographicDomain":["Cerrado"]}'],
    ]),
  ),
  'speciesprofile.txt': strToU8(tsv([['id', 'lifeForm'], ['1', '{"lifeForm":["Árvore"]}'], ['3', '{"lifeForm":["Erva"]}'], ['4', '{"lifeForm":["Árvore"]}'], ['5', '{"lifeForm":["Palmeira"]}']])),
});

describe('Flora e Funga (Darwin Core Archive)', () => {
  const flora = especiesDaFlora(lerDwca(pacote), { uf: 'TO', formasVida: FORMAS_VIDA_PADRAO });

  it('fica só com espécies aceitas que ocorrem no TO e com forma de vida de árvore/palmeira', () => {
    expect(flora.map((f) => f.nome_cientifico)).toEqual(['Ficticia alba Fulano', 'Palmeira ficticia Fulano']);
    expect(flora[0]).toMatchObject({
      flora_id: '1',
      familia: 'Ficticiaceae',
      origem: 'nativa',
      endemica: true,
      biomas: ['cerrado', 'amazonia'],
      nomesPopulares: ['árvore-branca'],
      sinonimos: ['Velhonome albus Beltrano'],
    });
    expect(flora[1].origem).toBe('cultivada');
  });

  it('nome da planilha que é sinônimo vira "revisar" com o nome aceito', () => {
    const plano = planejarFlora(
      flora,
      {
        especies: [
          { id: 'p1', nome_cientifico: 'Velhonome albus', familia: 'Ficticiaceae' },
          { id: 'p2', nome_cientifico: 'Exotica plantada' },
        ],
        nomesPopulares: [],
        sinonimos: [],
      },
      'TO',
    );
    expect(plano.atualizadas[0]).toMatchObject({ especie_id: 'p1', nomesPopulares: ['árvore-branca'] });
    expect(plano.atualizadas[0].dados).toMatchObject({ flora_id: '1', revisar: true, nota_revisao: 'na Flora e Funga o nome aceito é Ficticia alba Fulano' });
    expect(plano.novas.map((n) => n.dados.nome_cientifico)).toEqual(['Palmeira ficticia Fulano']);
    expect(plano.novas[0].dados).toMatchObject({ fonte_cadastro: 'flora_funga', publicada: false });
    expect(plano.avisos.some((a) => a.startsWith('Exotica plantada: não encontrada'))).toBe(true);
  });

  it('mesmo nome: só completa o que está vazio', () => {
    const plano = planejarFlora(flora, { especies: [{ id: 'p1', nome_cientifico: 'Ficticia alba', familia: 'Ficticiaceae', origem: 'cultivada' }], nomesPopulares: [{ especie_id: 'p1', nome: 'Árvore-Branca' }], sinonimos: [] }, 'TO');
    expect(plano.atualizadas[0].dados).toEqual({ flora_id: '1', autor: 'Fulano', forma_vida: 'Árvore', endemica: true });
    expect(plano.atualizadas[0].nomesPopulares).toEqual([]);
    expect(plano.atualizadas[0].sinonimos).toEqual(['Velhonome albus Beltrano']);
  });

  it('recusa arquivo que não é o pacote', () => {
    expect(() => lerDwca(new Uint8Array([1, 2, 3]))).toThrow(/Darwin Core/);
    expect(() => lerDwca(zipSync({ 'x.txt': strToU8('a') }))).toThrow(/meta.xml/);
  });
});
