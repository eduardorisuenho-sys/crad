import { describe, expect, it } from 'vitest';
import {
  codigoLoteMudas,
  codigoMatriz,
  codigoNaFaixa,
  codigoProvisorio,
  codigosRestantes,
  ehProvisorio,
  lerCodigo,
  letraDoIndice,
  indiceDaLetra,
  proximoCodigoLoteMudas,
  proximoDaFaixa,
  type FaixaCodigo,
} from '../src/codigos';

describe('códigos do lote', () => {
  it('formata a cadeia MT → LS → LM → DO', () => {
    expect(codigoMatriz(123)).toBe('MT-0123');
    expect(codigoLoteMudas('LS-2026-045', 0)).toBe('LM-2026-045-A');
    expect(lerCodigo('DO-2026-310')).toEqual({ tipo: 'DO', ano: 2026, numero: 310, provisorio: false });
    expect(lerCodigo('lm-2026-045-b')).toMatchObject({ tipo: 'LM', numero: 45, letra: 'B' });
    expect(lerCodigo('XX-1')).toBeNull();
  });

  it('letras passam de Z para AA', () => {
    expect(letraDoIndice(25)).toBe('Z');
    expect(letraDoIndice(26)).toBe('AA');
    for (const i of [0, 5, 25, 26, 27, 700]) expect(indiceDaLetra(letraDoIndice(i))).toBe(i);
  });

  it('próximo LM ignora lotes de outro LS', () => {
    expect(proximoCodigoLoteMudas('LS-2026-045', ['LM-2026-045-A', 'LM-2026-045-B', 'LM-2026-046-C'])).toBe('LM-2026-045-C');
    expect(proximoCodigoLoteMudas('LS-2026-045', [])).toBe('LM-2026-045-A');
  });

  it('usa a faixa reservada do aparelho e avisa quando acaba', () => {
    let faixas: FaixaCodigo[] = [{ tipo: 'MT', ano: 0, inicio: 500, fim: 501, ultimo: 499 }];
    const a = proximoDaFaixa(faixas, 'MT', 2026)!;
    expect(a.codigo).toBe('MT-0500');
    faixas = [a.faixa];
    expect(codigosRestantes(faixas, 'MT', 2026)).toBe(1);
    const b = proximoDaFaixa(faixas, 'MT', 2026)!;
    expect(b.codigo).toBe('MT-0501');
    expect(proximoDaFaixa([b.faixa], 'MT', 2026)).toBeNull();
    expect(codigoNaFaixa([b.faixa], 'MT-0501')).toBe(true);
    expect(codigoNaFaixa([b.faixa], 'MT-0502')).toBe(false);
  });

  it('faixas de LS e DO são por ano', () => {
    const faixas: FaixaCodigo[] = [{ tipo: 'LS', ano: 2025, inicio: 1, fim: 10, ultimo: 0 }];
    expect(proximoDaFaixa(faixas, 'LS', 2026)).toBeNull();
    expect(proximoDaFaixa(faixas, 'LS', 2025)!.codigo).toBe('LS-2025-001');
  });

  it('código provisório é reconhecido', () => {
    const c = codigoProvisorio('MT', 'ab12xyz', 3);
    expect(c).toBe('MT-P-AB12-3');
    expect(ehProvisorio(c)).toBe(true);
    expect(ehProvisorio('MT-0001')).toBe(false);
  });
});
