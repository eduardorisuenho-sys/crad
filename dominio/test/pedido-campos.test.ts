import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, faltaNaPessoa, faltaNoPlantio } from '../src/pedido-campos';

describe('pedido de mudas: todos os campos obrigatórios', () => {
  it('confere CPF e CNPJ pelos dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
  });

  it('plantio: finalidade, município, endereço e área', () => {
    expect(faltaNoPlantio({ finalidade: '', municipio: '', local: '', area: null })).toHaveLength(4);
    expect(faltaNoPlantio({ finalidade: 'Recuperar nascente', municipio: 'Palmas', local: 'Sítio Boa Vista', area: 0 })).toEqual(['Escreva a área aproximada em hectares (ex.: 0,5).']);
    expect(faltaNoPlantio({ finalidade: 'Recuperar nascente', municipio: 'Palmas', local: 'Sítio Boa Vista', area: 0.5 })).toEqual([]);
  });

  it('pessoa: nome completo, instituição, documento válido e telefone com DDD', () => {
    expect(faltaNaPessoa({ tipo: 'fisica', nome: 'Ana', instituicao: '', documento: '1', telefone: '9999' })).toHaveLength(4);
    expect(faltaNaPessoa({ tipo: 'fisica', nome: 'Ana Souza', instituicao: 'particular', documento: '529.982.247-25', telefone: '63 99999-0000' })).toEqual([]);
    expect(faltaNaPessoa({ tipo: 'juridica', nome: 'Ana Souza', instituicao: 'Escola X', documento: '529.982.247-25', telefone: '63 99999-0000' })).toEqual(['CNPJ incompleto ou com número errado.']);
  });
});
