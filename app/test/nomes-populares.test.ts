import { describe, expect, it } from 'vitest';
import { juntarNomes } from '../src/modulos/especies/FichaEspecie';

describe('vários nomes populares para a mesma espécie', () => {
  it('separa por vírgula ou ponto e vírgula e não repete (sem diferença de acento e maiúsculas)', () => {
    expect(juntarNomes([], "Ipê-amarelo, Pau-d'arco; ipê amarelo")).toEqual(['Ipê-amarelo', "Pau-d'arco"]) // "ipê amarelo" é o mesmo nome;
    expect(juntarNomes(['Ipê-amarelo'], 'IPÊ-AMARELO, Ipê-do-cerrado')).toEqual(['Ipê-amarelo', 'Ipê-do-cerrado']);
    expect(juntarNomes(['Baru'], '  ')).toEqual(['Baru']);
  });
});
