import { describe, expect, it } from 'vitest';
import { preencherTermo, TERMO_COMPROMISSO_PADRAO } from '../src/termo';
import { PARAMETROS_PADRAO } from '../src/esquema';

describe('termo de compromisso e declaração', () => {
  it('o texto padrão é o do órgão, e o administrador pode trocar pelo parâmetro', () => {
    expect(TERMO_COMPROMISSO_PADRAO).toMatch(/^TERMO DE COMPROMISSO E DECLARAÇÃO/);
    expect(TERMO_COMPROMISSO_PADRAO).toContain('NATURATINS');
    expect(TERMO_COMPROMISSO_PADRAO).toContain('geprh2023@gmail.com');
    expect(TERMO_COMPROMISSO_PADRAO).toContain('art. 299 do Código Penal');
    expect(PARAMETROS_PADRAO.termo_compromisso.valor).toBe(TERMO_COMPROMISSO_PADRAO);
  });

  it('preenche nome, espécies e quantidades, coordenadas, área e data', () => {
    const t = preencherTermo(TERMO_COMPROMISSO_PADRAO, {
      nome: 'Maria da Silva',
      itens: [
        { especie: 'Ipê-amarelo', quantidade: 20 },
        { especie: 'Jatobá', quantidade: 10 },
      ],
      lat: -10.184,
      lon: -48.3336,
      area_ha: 1.5,
      data: '2026-10-16',
    });
    expect(t).toContain('Eu, Maria da Silva, declaro');
    expect(t).toContain('(Ipê-amarelo: 20; Jatobá: 10; total 30 mudas)');
    expect(t).toContain('coordenadas -10.184000, -48.333600 e área de 1,5 ha');
    expect(t).toContain('Palmas/TO, 16/10/2026');
    expect(t).not.toMatch(/\[[A-ZÁÉ ]+\]/);
  });

  it('o que não foi informado fica escrito assim, sem inventar', () => {
    const t = preencherTermo('[COORDENADAS UTM/DECIMAIS] · [ÁREA TOTAL] · [NOME]', { itens: [], local: 'Sítio Boa Vista', data: '2026-10-16' });
    expect(t).toBe('não informadas (local: Sítio Boa Vista) · não informada · ______________________________');
  });
});
