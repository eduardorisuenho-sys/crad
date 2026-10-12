import { describe, expect, it } from 'vitest';
import { COLECOES, colecao } from '../src/esquema';
import { podeEscrever, type ContextoUsuario } from '../src/acesso';
import { celulaEditavel, escritaEfetiva, FUNCIONALIDADES, matrizDe, matrizPadrao, normalizarMatriz, temPermissao } from '../src/permissoes';
import { violacaoRegra } from '../src/regras-escrita';

const ctx = (perfis: ContextoUsuario['perfisPorViveiro'], extra: Partial<ContextoUsuario> = {}): ContextoUsuario => ({ id: 'u1', gestorGeral: false, solicitante: false, perfisPorViveiro: perfis, ...extra });

describe('tabela de permissões', () => {
  it('o padrão reproduz exatamente as regras do esquema', () => {
    const m = matrizPadrao();
    for (const c of COLECOES) expect([...escritaEfetiva(c, m)].sort(), c.nome).toEqual([...c.escrita].sort());
  });

  it('toda coleção citada existe e o padrão de cada linha cabe nas regras dela', () => {
    for (const f of FUNCIONALIDADES) for (const n of f.escrita ?? []) {
      const c = colecao(n);
      for (const p of f.padrao) expect(c.escrita, `${f.chave} → ${n}`).toContain(p);
    }
  });

  it('dar permissão ao coletor libera a gravação; tirar do viveirista bloqueia', () => {
    const m = normalizarMatriz({ ...matrizPadrao(), producao: ['coletor', 'gestor'] });
    const lote = { viveiro_id: 'v1', id: 'x' };
    expect(podeEscrever(ctx({ v1: ['coletor'] }, { permissoes: m }), colecao('lote_mudas'), lote)).toBe(true);
    expect(podeEscrever(ctx({ v1: ['viveirista'] }, { permissoes: m }), colecao('lote_mudas'), lote)).toBe(false);
    // sem tabela, vale o padrão
    expect(podeEscrever(ctx({ v1: ['viveirista'] }), colecao('lote_mudas'), lote)).toBe(true);
  });

  it('células travadas não mudam (LGPD, só administrador, solicitante fora da equipe)', () => {
    const m = normalizarMatriz({ dados_pessoais: ['coletor', 'viveirista'], permissoes: ['gestor'], producao: ['solicitante', 'viveirista'] });
    expect(m.dados_pessoais).toEqual(['gestor']);
    expect(m.permissoes).toEqual([]);
    expect(m.producao).toEqual(['viveirista']);
    expect(celulaEditavel(FUNCIONALIDADES.find((f) => f.chave === 'pedir_mudas')!, 'solicitante')).toBe(true);
  });

  it('administrador pode tudo; permissão vale por viveiro', () => {
    const m = matrizPadrao();
    expect(temPermissao(ctx({}, { gestorGeral: true, permissoes: m }), 'permissoes')).toBe(true);
    expect(temPermissao(ctx({ v1: ['gestor'] }, { permissoes: m }), 'permissoes')).toBe(false);
    expect(temPermissao(ctx({ v1: ['gestor'], v2: ['coletor'] }, { permissoes: m }), 'validar_matriz', 'v1')).toBe(true);
    expect(temPermissao(ctx({ v1: ['gestor'], v2: ['coletor'] }, { permissoes: m }), 'validar_matriz', 'v2')).toBe(false);
    expect(temPermissao(ctx({}, { solicitante: true, permissoes: m }), 'pedir_mudas')).toBe(true);
  });

  it('lê a tabela dos parâmetros e aproveita o antigo perfis_aprovadores', () => {
    expect(matrizDe([{ chave: 'perfis_aprovadores', valor: ['gestor', 'viveirista'] }]).aprovar_doacao).toEqual(['viveirista', 'gestor']);
    expect(matrizDe([{ chave: 'permissoes', valor: { aprovar_doacao: ['gestor'] } }, { chave: 'perfis_aprovadores', valor: ['viveirista'] }]).aprovar_doacao).toEqual(['gestor']);
  });

  it('regras de campo: aprovar matriz, vistoria e a própria tabela', () => {
    const coletor = ctx({ v1: ['coletor'] }, { permissoes: matrizPadrao() });
    const antes = { id: 'm', viveiro_id: 'v1', situacao_validacao: 'pendente' };
    expect(violacaoRegra(colecao('matriz'), null, { ...antes }, coletor)).toBeNull();
    expect(violacaoRegra(colecao('matriz'), antes, { ...antes, situacao_validacao: 'aprovada' }, coletor)).toMatch(/aprovar matrizes/);
    const liberado = ctx({ v1: ['coletor'] }, { permissoes: normalizarMatriz({ validar_matriz: ['coletor', 'gestor'] }) });
    expect(violacaoRegra(colecao('matriz'), antes, { ...antes, situacao_validacao: 'aprovada' }, liberado)).toBeNull();
    const sol = ctx({}, { solicitante: true, permissoes: matrizPadrao() });
    expect(violacaoRegra(colecao('monitoramento'), null, { id: 'x', viveiro_id: 'v1', tipo: 'vistoria' }, sol)).toMatch(/vistoria/);
    expect(violacaoRegra(colecao('monitoramento'), null, { id: 'x', viveiro_id: 'v1', tipo: 'relato' }, sol)).toBeNull();
    expect(violacaoRegra(colecao('parametro'), null, { id: 'p', chave: 'permissoes', valor: {} }, ctx({ v1: ['gestor'] }))).toMatch(/administrador/);
    expect(violacaoRegra(colecao('parametro'), null, { id: 'p', chave: 'permissoes', valor: {} }, ctx({}, { gestorGeral: true }))).toBeNull();
  });
});
