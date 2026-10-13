import { describe, expect, it } from 'vitest';
import { colecao } from '../src/esquema';
import { codigoEstoqueInicial, lerCodigo, proximoCodigoEstoqueInicial, proximoCodigoLoteMudas } from '../src/codigos';
import { bloqueiosEstoqueInicial, lerFase, modeloPlanilhaEstoque, planejarEstoqueInicial } from '../src/estoque-inicial';
import { matrizPadrao, normalizarMatriz } from '../src/permissoes';
import { violacaoRegra } from '../src/regras-escrita';
import { montarRastreio } from '../src/catalogo';
import type { ContextoUsuario } from '../src/acesso';

// Espécies de teste (fictícias).
const especies = [
  { id: 'e1', nome_cientifico: 'Ficticia alfa' },
  { id: 'e2', nome_cientifico: 'Ficticia beta' },
];
const populares = [{ id: 'n1', especie_id: 'e1', nome: 'Árvore-alfa' }];
const ctx = (perfis: string[], extra: Partial<ContextoUsuario> = {}): ContextoUsuario => ({ id: 'u', gestorGeral: false, solicitante: false, perfisPorViveiro: { v1: perfis as never }, permissoes: matrizPadrao(), ...extra });

describe('estoque inicial (mudas que já estavam no viveiro)', () => {
  it('código próprio LM-AAAA-I-NNN, sem misturar com os lotes de semeadura', () => {
    expect(codigoEstoqueInicial(2026, 7)).toBe('LM-2026-I-007');
    expect(lerCodigo('lm-2026-i-007')).toMatchObject({ tipo: 'LM', ano: 2026, numero: 7, inicial: true });
    expect(proximoCodigoEstoqueInicial(2026, ['LM-2026-I-001', 'LM-2026-I-004', 'LM-2025-I-009', 'LM-2026-004-A'])).toBe('LM-2026-I-005');
    expect(proximoCodigoLoteMudas('LS-2026-001', ['LM-2026-I-001', 'LM-2026-001-A'])).toBe('LM-2026-001-B');
  });

  it('lê a planilha: nome científico ou popular, linha de exemplo ignorada, tudo entra pronto para doação', () => {
    const linhas = [
      ['Espécie', 'Quantidade', 'Canteiro', 'Observação'],
      ...modeloPlanilhaEstoque().slice(1),
      ['arvore alfa', '1.200', 'C3', ''],
      ['FICTICIA BETA', 40, '', 'sacos grandes'],
      ['Desconhecida', 5, '', ''],
      ['Ficticia alfa', 'muitas', '', ''],
      ['', '', '', ''],
    ];
    const r = planejarEstoqueInicial(linhas, especies, populares);
    expect(r.itens).toEqual([
      { especie_id: 'e1', quantidade: 1200, fase: 'pronta', canteiro: 'C3', observacao: undefined, linha: 3 },
      { especie_id: 'e2', quantidade: 40, fase: 'pronta', canteiro: undefined, observacao: 'sacos grandes', linha: 4 },
    ]);
    expect(r.erros).toHaveLength(2);
    expect(r.erros[0]).toMatch(/Linha 5: espécie "Desconhecida" não encontrada/);
    expect(r.erros[1]).toMatch(/Linha 6: quantidade inválida/);
    // planilha antiga com a coluna Fase: a coluna é ignorada
    expect(planejarEstoqueInicial([['Espécie', 'Quantidade', 'Fase'], ['Ficticia alfa', 3, 'Crescimento']], especies, []).itens[0].fase).toBe('pronta');
    expect(planejarEstoqueInicial([['Nome', 'Qtd']], especies, []).erros).toEqual([]);
    expect(planejarEstoqueInicial([['A', 'B']], especies, []).erros[0]).toMatch(/colunas/);
  });

  it('fase e bloqueios', () => {
    expect(lerFase('')).toBe('pronta');
    expect(lerFase('Germinação')).toBe('germinacao');
    expect(lerFase('xx')).toBeNull();
    expect(bloqueiosEstoqueInicial([{ quantidade: 0, fase: 'pronta' }])).toEqual(['Informe a quantidade de pelo menos uma espécie.']);
    expect(bloqueiosEstoqueInicial([{ quantidade: 2.5, fase: 'pronta' }])).toContain('Use números inteiros nas quantidades.');
  });

  it('regras: semeadura exige lote de sementes; estoque inicial exige permissão', () => {
    const lote = { id: 'l', viveiro_id: 'v1', especie_id: 'e1', codigo: 'LM-P-AB-1' };
    expect(violacaoRegra(colecao('lote_mudas'), null, lote, ctx(['viveirista']))).toMatch(/lote de sementes/);
    expect(violacaoRegra(colecao('lote_mudas'), null, { ...lote, origem: 'estoque_inicial' }, ctx(['viveirista']))).toBeNull();
    expect(violacaoRegra(colecao('lote_mudas'), null, { ...lote, origem: 'estoque_inicial' }, ctx(['coletor']))).toMatch(/já estavam no viveiro/);
    const semPermissao = ctx(['viveirista'], { permissoes: normalizarMatriz({ estoque_inicial: ['gestor'] }) });
    expect(violacaoRegra(colecao('lote_mudas'), null, { ...lote, origem: 'estoque_inicial' }, semPermissao)).toMatch(/já estavam no viveiro/);
  });

  it('rastreio público diz que a origem não foi registrada (sem inventar matrizes)', () => {
    const r = montarRastreio({ id: 'l', codigo: 'LM-2026-I-001', viveiro_id: 'v', fase_atual: 'pronta', origem: 'estoque_inicial' }, { viveiros: [{ id: 'v', nome: 'Viveiro Um' }], lotesSementes: [], ligacoes: [], coletas: [], matrizes: [], municipios: [] });
    expect(r.lote_mudas.estoque_inicial).toBe(true);
    expect(r.lote_sementes).toBeUndefined();
  });
});
