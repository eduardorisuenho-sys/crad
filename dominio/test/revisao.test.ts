/** Achados da revisão de segurança e correção (cada teste reproduz um caso). */
import { describe, expect, it } from 'vitest';
import { podeLer, type ContextoUsuario } from '../src/acesso';
import { colecao } from '../src/esquema';
import { dependentesAtivos } from '../src/lixeira';
import { violacaoRegra } from '../src/regras-escrita';
import { servicoColetor } from '../src/servico-coletor';
import { resolverOperacao, type PortaServidor } from '../src/sync/resolver';
import { op, VIV_PALMAS } from './apoio';

const porta: PortaServidor = { codigoEmUso: () => false, novoCodigo: () => 'MT-0900', faixasDoDispositivo: () => [] };
const ctx = (perfis: ContextoUsuario['perfisPorViveiro'], extra: Partial<ContextoUsuario> = {}): ContextoUsuario => ({ id: 'usreu0000000001', gestorGeral: false, solicitante: false, perfisPorViveiro: perfis, ...extra });
const base = { versao: 1, excluido: false, viveiro_id: VIV_PALMAS };

describe('conta criada pelo celular, ainda sem perfil', () => {
  const pendente = ctx({});
  it('não lê o cadastro de outras pessoas', () => {
    expect(podeLer(pendente, colecao('pessoa'), { id: 'p1', nome: 'Fulana', usuario_id: 'outra' })).toBe(false);
    expect(podeLer(pendente, colecao('pessoa'), { id: 'p2', nome: 'Eu', usuario_id: pendente.id })).toBe(true);
  });
  it('continua lendo o catálogo público', () => {
    expect(podeLer(pendente, colecao('especie'), { id: 'e1' })).toBe(true);
  });
});

describe('tabela de permissões', () => {
  it('gestor de viveiro não apaga a tabela do administrador (exclusão também passa pelas regras)', () => {
    const gestor = ctx({ [VIV_PALMAS]: ['gestor'] });
    const atual = { id: 'parpermissoes01', chave: 'permissoes', valor: {}, versao: 3, excluido: false };
    const d = resolverOperacao(op({ colecao: 'parametro', registro_id: atual.id, tipo: 'excluir', base_versao: 3 }), atual, gestor, porta);
    expect(d.resultado.status).toBe('rejeitada');
  });
});

describe('equipe pela sincronização', () => {
  const comEquipe = ctx({ [VIV_PALMAS]: ['viveirista'] }, { permissoes: { equipe: ['gestor', 'viveirista'] } });
  it('viveirista com a permissão "equipe" não se promove nem cria gestor', () => {
    expect(violacaoRegra(colecao('usuario_viveiro'), null, { ...base, usuario_id: comEquipe.id, perfil: 'gestor' }, comEquipe)).toMatch(/gestor/);
    expect(violacaoRegra(colecao('usuario_viveiro'), null, { ...base, usuario_id: 'outro', perfil: 'gestor' }, comEquipe)).toMatch(/gestor/);
  });
  it('não tira o vínculo de um gestor', () => {
    const vinculo = { ...base, usuario_id: 'outro', perfil: 'gestor' };
    expect(violacaoRegra(colecao('usuario_viveiro'), vinculo, { ...vinculo, excluido: true }, comEquipe)).toMatch(/gestor/);
  });
  it('pode cadastrar coletor', () => {
    expect(violacaoRegra(colecao('usuario_viveiro'), null, { ...base, usuario_id: 'outro', perfil: 'coletor' }, comEquipe)).toBeNull();
  });
});

describe('estoque inicial não vira permissão de produção', () => {
  const soEstoque = ctx({ [VIV_PALMAS]: ['coletor'] }, { permissoes: { estoque_inicial: ['gestor', 'viveirista', 'coletor'] } });
  it('cadastra o estoque inicial e a entrada dele', () => {
    expect(violacaoRegra(colecao('lote_mudas'), null, { ...base, origem: 'estoque_inicial' }, soEstoque)).toBeNull();
    expect(violacaoRegra(colecao('movimento_estoque_mudas'), null, { ...base, tipo: 'entrada', referencia: 'estoque inicial' }, soEstoque)).toBeNull();
  });
  it('não semeia, não muda lote, não registra perda nem saída', () => {
    expect(violacaoRegra(colecao('lote_mudas'), null, { ...base, origem: 'semeadura', lote_sementes_id: 'ls' }, soEstoque)).toMatch(/permissão/);
    const lote = { ...base, origem: 'estoque_inicial', fase_atual: 'pronta' };
    expect(violacaoRegra(colecao('lote_mudas'), lote, { ...lote, situacao: 'encerrado' }, soEstoque)).toMatch(/permissão/);
    expect(violacaoRegra(colecao('movimento_estoque_mudas'), null, { ...base, tipo: 'perda' }, soEstoque)).toMatch(/permissão/);
    expect(violacaoRegra(colecao('movimento_estoque_mudas'), null, { ...base, tipo: 'saida_doacao' }, soEstoque)).toMatch(/permissão/);
  });
  it('quem só entrega mudas registra a saída da doação', () => {
    const soRetirada = ctx({ [VIV_PALMAS]: ['viveirista'] }, { permissoes: { producao: ['gestor'] } });
    expect(violacaoRegra(colecao('movimento_estoque_mudas'), null, { ...base, tipo: 'saida_doacao' }, soRetirada)).toBeNull();
    expect(violacaoRegra(colecao('movimento_estoque_mudas'), null, { ...base, tipo: 'perda' }, soRetirada)).toMatch(/permissão/);
  });
});

describe('lixeira', () => {
  it('viveiro com matrizes ativas não é apagado de vez', () => {
    const deps = dependentesAtivos('viveiro', 'v1', (c, campo) => (c === 'matriz' && campo === 'viveiro_id' ? [{ id: 'm1', excluido: false }] : []));
    expect(deps).toEqual([{ colecao: 'matriz', quantidade: 1 }]);
  });
});

describe('relatório do coletor', () => {
  // Vale em qualquer fuso; no de Palmas (UTC-3) pegava o dia errado antes da correção.
  it('usa o dia do aparelho, não o de Greenwich', () => {
    // 31/10 às 21h30 em Palmas = 01/11 00h30 em UTC
    const m = { id: 'm1', coletor_id: 'c', criado_no_aparelho_em: new Date(2026, 9, 31, 21, 30).toISOString(), viveiro_id: 'v' };
    const r = servicoColetor({ matrizes: [m], coletas: [], fenologias: [], fotos: [] }, { coletorId: 'c', inicio: '2026-10-01', fim: '2026-10-31' });
    expect(r.matrizes).toHaveLength(1);
  });
});
