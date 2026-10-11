import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUNAS_ESPECIE } from '../src/especies/importar';
import { lerXlsx } from '../src/planilha/xlsx';
import { buscarNomes, nomeBase, normalizarBusca, problemasNome } from '../src/especies/nomes';
import { lerLinhas, planejarImportacao } from '../src/especies/importar';

// Nomes FICTÍCIOS: os testes não carregam dados botânicos reais.
describe('nomes', () => {
  it('normaliza para busca', () => {
    expect(normalizarBusca("Ipê-Roxo  do Brejo")).toBe('ipe roxo do brejo');
    expect(normalizarBusca("pau-d'arco")).toBe('pau d arco');
  });

  it('nome-base ignora autor e mantém subespécie/variedade', () => {
    expect(nomeBase('Ficticia arborea (Fulano) Sicrano')).toBe('ficticia arborea');
    expect(nomeBase('Ficticia arborea Fulano var. alta')).toBe('ficticia arborea var alta');
    expect(nomeBase('Ficticia arborea subsp. minor (X.) Y.')).toBe('ficticia arborea subsp minor');
    expect(nomeBase('Ficticia sp.')).toBe('ficticia');
  });

  it('aponta nomes que precisam de conferência', () => {
    expect(problemasNome('Ficticia alba ou F. rubra')).toContain('mais de uma espécie no mesmo nome');
    expect(problemasNome('Ficticia alba et. Al.')).toContain('nome com "et al."');
    expect(problemasNome('Ficticia sp.')).toContain('identificado só até o gênero');
    expect(problemasNome('Ficticia alba Fulano')).toEqual([]);
  });

  it('busca tolera acento, variação e erro de digitação', () => {
    const entradas = [
      { especie_id: 'a', nome: 'Ipê-roxo', tipo: 'popular' as const },
      { especie_id: 'a', nome: "Pau-d'arco", tipo: 'popular' as const },
      { especie_id: 'b', nome: 'Ipê-amarelo', tipo: 'popular' as const },
      { especie_id: 'c', nome: 'Pequizeiro-fictício', tipo: 'popular' as const },
      { especie_id: 'c', nome: 'Ficticia caryocar', tipo: 'cientifico' as const },
    ];
    expect(buscarNomes('ipe', entradas).map((r) => r.especie_id)).toEqual(['b', 'a']);
    expect(buscarNomes('ipê roxo', entradas)[0].especie_id).toBe('a');
    expect(buscarNomes('pau darco', entradas)[0]?.especie_id).toBe('a');
    expect(buscarNomes('pequisero', entradas)[0]?.especie_id).toBe('c');
    expect(buscarNomes('caryocar', entradas)[0]?.especie_id).toBe('c');
    expect(buscarNomes('xyzw', entradas)).toEqual([]);
  });
});

describe('importação de espécies', () => {
  // Mesmo formato da aba "Espécies" da planilha de controle: título, linhas vazias e o cabeçalho na linha 4.
  const planilha = [
    [],
    [undefined, 'Lista de espécies'],
    [],
    [undefined, undefined, 'Nome Polular', 'Família Botânica', 'Nome Científico'],
    [undefined, undefined, 'Árvore-um', 'Ficticiaceae', 'Ficticia alba Fulano'],
    [undefined, undefined, 'Árvore-um-branca', 'Ficticiaceae', 'Ficticia alba'],
    [undefined, undefined, 'Pau-dois/Pau-do-brejo', 'Ficticiaceae', 'Ficticia rubra Sicrano'],
    [undefined, undefined, 'Pau-dois-miúdo', 'Outraceae', 'Ficticia rubra Sicrano'],
    [undefined, undefined, 'Mistura', 'Ficticiaceae', 'Ficticia alba ou F. rubra'],
    [undefined, undefined, 'Sem nome', 'Ficticiaceae'],
    [undefined, undefined, 'Árvore-um', 'Ficticiaceae', 'Ficticia nigra'],
  ];

  it('acha o cabeçalho, aceita "Nome Polular" e quebra nomes com barra', () => {
    const { registros } = lerLinhas(planilha);
    expect(registros).toHaveLength(7);
    const p = planejarImportacao(registros, { especies: [], nomesPopulares: [], sinonimos: [] });
    const rubra = p.novas.find((n) => n.chave === 'ficticia rubra')!;
    expect(rubra.nomesPopulares).toEqual(['Pau-dois', 'Pau-do-brejo', 'Pau-dois-miúdo']);
  });

  it('junta grafias da mesma espécie e marca para revisar o que é duvidoso', () => {
    const p = planejarImportacao(lerLinhas(planilha).registros, { especies: [], nomesPopulares: [], sinonimos: [] });
    expect(p.resumo).toMatchObject({ especies: 4, novas: 4, paraRevisar: 2 });
    const alba = p.novas.find((n) => n.chave === 'ficticia alba')!;
    expect(alba.dados).toMatchObject({ nome_cientifico: 'Ficticia alba Fulano', familia: 'Ficticiaceae', fonte_cadastro: 'planilha' });
    expect(alba.dados.revisar).toBeUndefined();
    expect(p.novas.find((n) => n.chave === 'ficticia rubra')!.dados).toMatchObject({ revisar: true, nota_revisao: 'famílias diferentes na planilha: Ficticiaceae, Outraceae' });
    expect(p.novas.find((n) => n.chave.startsWith('?'))!.dados.revisar).toBe(true);
    expect(p.erros).toEqual([{ linha: 10, mensagem: 'sem nome científico (Sem nome)' }]);
    expect(p.avisos.some((a) => a.mensagem.includes('"arvore um" aparece em 2 espécies'))).toBe(true);
  });

  it('lê meses em número, abreviados ou por intervalo', () => {
    const ler = (v: string) => lerLinhas([['Nome científico', 'Meses de fruto'], ['Ficticia alba', v]]).registros[0].meses_fruto;
    expect(ler('9,10,11')).toEqual([9, 10, 11]);
    expect(ler('Setembro a Novembro')).toEqual([9, 10, 11]);
    expect(ler('nov a fev')).toEqual([1, 2, 11, 12]);
    expect(ler('nada')).toBeUndefined();
  });

  it('não sobrescreve a ficha já cadastrada: só completa o vazio e acrescenta nomes', () => {
    const p = planejarImportacao(
      lerLinhas([
        ['Nome popular', 'Família', 'Nome científico', 'Lorenzi volume', 'Meses de flor', 'Folha'],
        ['Árvore-um', 'Ficticiaceae', 'Ficticia alba Fulano', '2', 'set, out e 11', 'composta'],
        ['Nova-alcunha', 'Ficticiaceae', 'Ficticia antiga Beltrano', '', '', ''],
      ]).registros,
      {
        especies: [{ id: 'esp1', nome_cientifico: 'Ficticia alba Fulano', familia: 'Ficticiaceae', folha: 'simples' }],
        nomesPopulares: [{ especie_id: 'esp1', nome: 'arvore-um' }],
        sinonimos: [{ especie_id: 'esp1', nome: 'Ficticia antiga Beltrano' }],
      },
    );
    expect(p.novas).toHaveLength(0);
    const alvo = p.atualizadas.filter((a) => a.especie_id === 'esp1');
    expect(alvo[0].dados).toEqual({ lorenzi_volume: 2, meses_flor: [9, 10, 11] });
    expect(alvo[0].nomesPopulares).toEqual([]);
    expect(alvo[1].nomesPopulares).toEqual(['Nova-alcunha']);
    expect(p.avisos.some((a) => a.mensagem.includes('é sinônimo de Ficticia alba Fulano'))).toBe(true);
  });
});

describe('modelo de planilha (dados/modelo-especies.xlsx)', () => {
  it('tem todas as colunas que o importador conhece, e o exemplo entra como fictício', () => {
    const abas = lerXlsx(new Uint8Array(readFileSync(new URL('../../dados/modelo-especies.xlsx', import.meta.url))));
    const { registros } = lerLinhas(abas[0].linhas);
    expect(registros).toHaveLength(1);
    const cabecalho = abas[0].linhas[2].map((c) => String(c).replace(' *', ''));
    expect(cabecalho).toEqual(Object.values(COLUNAS_ESPECIE).map((c) => c.rotulo));
    const p = planejarImportacao(registros, { especies: [], nomesPopulares: [], sinonimos: [] });
    expect(p.novas[0].dados).toMatchObject({ ficticia: true, publicada: false, meses_flor: [9, 10, 11] });
  });
});
