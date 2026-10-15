/** O script do servidor reduz o pacote da Flora e Funga à UF, e o app continua lendo igual. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { especiesDaFlora, FORMAS_VIDA_PADRAO, lerDwca } from '../../dominio/src/especies/flora';

// Pacote FICTÍCIO no formato do IPT do JBRJ.
const meta = `<?xml version="1.0"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/">
  <core encoding="UTF-8" fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Taxon">
    <files><location>taxon.txt</location></files>
    <id index="0"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/acceptedNameUsageID"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/scientificName"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/family"/>
    <field index="4" term="http://rs.tdwg.org/dwc/terms/taxonRank"/>
    <field index="5" term="http://rs.tdwg.org/dwc/terms/taxonomicStatus"/>
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
  </extension>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/SpeciesProfile">
    <files><location>speciesprofile.txt</location></files>
    <coreid index="0"/>
    <field index="1" term="http://rs.gbif.org/terms/1.0/lifeForm"/>
  </extension>
</archive>`;
const tsv = (l: string[][]) => l.map((x) => x.join('\t')).join('\n');
const pacote = zipSync({
  'meta.xml': strToU8(meta),
  'taxon.txt': strToU8(tsv([['id', 'acceptedNameUsageID', 'scientificName', 'family', 'taxonRank', 'taxonomicStatus'], ['1', '', 'Ficticia alba', 'Ficticiaceae', 'ESPECIE', 'NOME_ACEITO'], ['2', '1', 'Velhonome albus', 'Ficticiaceae', 'ESPECIE', 'SINONIMO'], ['4', '', 'Ficticia baiana', 'Ficticiaceae', 'ESPECIE', 'NOME_ACEITO']])),
  'vernacularname.txt': strToU8(tsv([['id', 'vernacularName', 'language'], ['1', 'árvore-branca', 'PORTUGUES'], ['1', 'pau-branco', 'PORTUGUES'], ['4', 'baianinha', 'PORTUGUES']])),
  'distribution.txt': strToU8(tsv([['id', 'locationID'], ['1', 'BR-TO'], ['1', 'BR-GO'], ['4', 'BR-BA']])),
  'speciesprofile.txt': strToU8(tsv([['id', 'lifeForm'], ['1', '{"lifeForm":["Árvore"]}'], ['4', '{"lifeForm":["Árvore"]}']])),
});

describe('lista oficial de espécies baixada pelo servidor', () => {
  it('fica só o que ocorre no TO (com sinônimos e nomes populares) e o app lê o pacote reduzido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flora-'));
    writeFileSync(join(dir, 'entrada.zip'), pacote);
    execFileSync('python3', [join(__dirname, '..', 'deploy', 'flora.py'), join(dir, 'saida.zip'), 'TO', join(dir, 'entrada.zip')]);
    const d = lerDwca(new Uint8Array(readFileSync(join(dir, 'saida.zip'))));
    expect(d.taxon.map((t) => t.scientificName).sort()).toEqual(['Ficticia alba', 'Velhonome albus']);
    const especies = especiesDaFlora(d, { uf: 'TO', formasVida: FORMAS_VIDA_PADRAO });
    expect(especies).toEqual([expect.objectContaining({ nome_cientifico: 'Ficticia alba', familia: 'Ficticiaceae', nomesPopulares: ['árvore-branca', 'pau-branco'], sinonimos: ['Velhonome albus'] })]);
  });
});
