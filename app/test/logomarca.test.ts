import { describe, expect, it } from 'vitest';
import { caber, definirLogomarca, ehLogomarca, logomarcaAtual, logomarcaNoPdf } from '../src/plataforma/logomarca';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('logomarca da instituição', () => {
  it('cabe no espaço sem deformar', () => {
    expect(caber({ largura: 300, altura: 120 }, 36, 14)).toEqual({ largura: 35, altura: 14 });
    expect(caber({ largura: 100, altura: 400 }, 34, 22)).toEqual({ largura: 5.5, altura: 22 });
  });

  it('só aceita imagem PNG ou JPG em data URL', () => {
    expect(ehLogomarca({ imagem: PNG, largura: 1, altura: 1 })).toBe(true);
    expect(ehLogomarca({ imagem: 'javascript:alert(1)', largura: 1, altura: 1 })).toBe(false);
    expect(ehLogomarca(null)).toBe(false);
  });

  it('no PDF: canto direito, encostada na margem; sem logomarca, não desenha', () => {
    const chamadas: unknown[][] = [];
    const pdf = { addImage: (...a: unknown[]) => chamadas.push(a) };
    definirLogomarca(null);
    expect(logomarcaNoPdf(pdf)).toBe(0);
    definirLogomarca({ imagem: PNG, largura: 300, altura: 120 });
    expect(logomarcaAtual()?.largura).toBe(300);
    expect(logomarcaNoPdf(pdf, { y: 8, larguraMax: 36, alturaMax: 14 })).toBe(35);
    expect(chamadas).toEqual([[PNG, 'PNG', 160, 8, 35, 14]]);
    definirLogomarca(null);
  });
});
