import { describe, expect, it } from 'vitest';
import { etiquetasPdf, ETIQUETAS_POR_FOLHA, fichasPdf, posicaoEtiqueta, textoDaFicha } from '../src/plataforma/pdfFichas';
import { codigoDoQr, linkRastreio } from '../src/plataforma/rastreio';
import { fichaDaEspecie, fichaDoItem } from '../src/modulos/catalogo/fichasPdf';

const publica = {
  ficha: { id: 'e1', nome_cientifico: 'Arvorea ficticia', familia: 'Fabaceae', fruto: 'vagem', meses_fruto: [8, 9], lorenzi_volume: 1, lorenzi_pagina: 120, ficticia: true },
  nomes_populares: ['Árvore-de-campo-fictícia', 'pau-de-teste'],
  fotos: [],
  lotes: [
    { disponivel: 30, viveiro: 'Viveiro Teste', rastreio: {} as never },
    { disponivel: 10, viveiro: 'Viveiro Teste', rastreio: {} as never },
  ],
};

describe('fichas das espécies em PDF', () => {
  it('usa só o que está cadastrado na espécie', () => {
    const f = fichaDaEspecie(publica, 'Pedidas: 20 · Aprovadas: 15');
    expect(f.nome).toBe('Árvore-de-campo-fictícia');
    expect(f.outrosNomes).toEqual(['pau-de-teste']);
    const texto = textoDaFicha(f);
    expect(texto.join(' ')).not.toContain('ESPÉCIE FICTÍCIA');
    expect(texto).toContain('Arvorea ficticia · Fabaceae');
    expect(texto).toContain('Pedidas: 20 · Aprovadas: 15');
    expect(texto).toContain('Frutos: ago, set');
    expect(texto).toContain('Onde tem mudas: Viveiro Teste (40)');
    expect(texto).toContain('Referência: Lorenzi, Árvores Brasileiras, vol. 1, p. 120');
    // nada de campo vazio inventado
    expect(texto.some((l) => /Flores|Casca|Folha/.test(l))).toBe(false);
  });

  it('sem a ficha pública, fica só com os nomes', () => {
    const f = fichaDoItem({ nome_cientifico: 'Arvorea ficticia', familia: '', nomes_populares: [] }, '5 mudas prontas');
    expect(textoDaFicha(f)).toEqual(['Arvorea ficticia', 'Arvorea ficticia', '5 mudas prontas']);
  });

  it('gera o PDF com duas fichas por folha', async () => {
    const fichas = [1, 2, 3].map(() => fichaDaEspecie(publica));
    const b = await fichasPdf('Catálogo de mudas nativas', 'teste', fichas);
    const texto = Buffer.from(await b.arrayBuffer()).toString('latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto.match(/\/Type \/Page\b/g)?.length).toBe(2);
  });
});

describe('etiquetas com QR para as mudas', () => {
  it('24 etiquetas por folha A4, sem passar da margem', () => {
    expect(ETIQUETAS_POR_FOLHA).toBe(24);
    const ultima = posicaoEtiqueta(23);
    expect(ultima.pagina).toBe(0);
    expect(ultima.x + ultima.largura).toBeLessThanOrEqual(205);
    expect(ultima.y + ultima.altura).toBeLessThanOrEqual(290);
    expect(posicaoEtiqueta(24)).toMatchObject({ pagina: 1, x: 7, y: 12 });
  });

  it('gera uma folha por 24 etiquetas', async () => {
    const e = { codigo: 'LM-2026-001-A', nome: 'Árvore-de-campo-fictícia', cientifico: 'Arvorea ficticia', qr: linkRastreio('LM-2026-001-A', 'https://crad.exemplo') };
    const b = await etiquetasPdf(Array.from({ length: 30 }, () => e));
    const texto = Buffer.from(await b.arrayBuffer()).toString('latin1');
    expect(texto.match(/\/Type \/Page\b/g)?.length).toBe(2);
  });

  it('o QR grava o endereço do rastreio e o leitor do app tira o código dele', () => {
    const url = linkRastreio('LM-2026-001-A', 'https://crad.exemplo');
    expect(url).toBe('https://crad.exemplo/rastreio/LM-2026-001-A');
    expect(codigoDoQr(url)).toBe('LM-2026-001-A');
    expect(codigoDoQr(' mt-0123 ')).toBe('MT-0123');
  });
});
