import { describe, expect, it } from 'vitest';
import { podeEscrever, podeLer } from '../src/acesso';
import { colecao } from '../src/esquema';
import { coletorPalmas, gestorGeral, solicitante, VIV_GURUPI, VIV_PALMAS, viveiristaPalmas } from './apoio';

describe('perfis e viveiros', () => {
  const matrizPalmas = { id: 'x', viveiro_id: VIV_PALMAS };
  const matrizGurupi = { id: 'y', viveiro_id: VIV_GURUPI };

  it('coletor só enxerga e escreve matrizes do próprio viveiro', () => {
    expect(podeLer(coletorPalmas, colecao('matriz'), matrizPalmas)).toBe(true);
    expect(podeLer(coletorPalmas, colecao('matriz'), matrizGurupi)).toBe(false);
    expect(podeEscrever(coletorPalmas, colecao('matriz'), matrizPalmas)).toBe(true);
    expect(podeEscrever(coletorPalmas, colecao('matriz'), matrizGurupi)).toBe(false);
  });

  it('gestor geral enxerga todos os viveiros', () => {
    expect(podeLer(gestorGeral, colecao('matriz'), matrizGurupi)).toBe(true);
  });

  it('viveirista não cadastra matriz, mas cadastra lote de mudas', () => {
    expect(podeEscrever(viveiristaPalmas, colecao('matriz'), matrizPalmas)).toBe(false);
    expect(podeEscrever(viveiristaPalmas, colecao('lote_mudas'), matrizPalmas)).toBe(true);
  });

  it('LGPD: CPF e telefone só o gestor lê, mesmo quem cadastrou', () => {
    const dp = { id: 'z', pessoa_id: 'p', documento: '000', criado_por: coletorPalmas.id };
    expect(podeEscrever(coletorPalmas, colecao('dados_pessoais'), dp)).toBe(true);
    expect(podeLer(coletorPalmas, colecao('dados_pessoais'), dp)).toBe(false);
    expect(podeLer(gestorGeral, colecao('dados_pessoais'), dp)).toBe(true);
  });

  it('solicitante só vê os próprios pedidos e não vê matrizes', () => {
    const meu = { id: 'a', viveiro_id: VIV_PALMAS, solicitante_usuario_id: solicitante.id };
    const outro = { id: 'b', viveiro_id: VIV_PALMAS, solicitante_usuario_id: 'outro' };
    expect(podeLer(solicitante, colecao('doacao'), meu)).toBe(true);
    expect(podeLer(solicitante, colecao('doacao'), outro)).toBe(false);
    expect(podeEscrever(solicitante, colecao('doacao'), outro)).toBe(false);
    expect(podeLer(solicitante, colecao('matriz'), matrizPalmas)).toBe(false);
  });

  it('coletor não vê doações de outro viveiro', () => {
    expect(podeLer(coletorPalmas, colecao('doacao'), { id: 'd', viveiro_id: VIV_GURUPI })).toBe(false);
  });
});
