import { describe, expect, it } from 'vitest';
import { codigoMatriz } from '../src/codigos';
import type { PortaServidor } from '../src/sync/resolver';
import { resolverOperacao } from '../src/sync/resolver';
import type { Registro } from '../src/sync/tipos';
import { coletorPalmas, gestorGeral, op, solicitante, VIV_GURUPI, VIV_PALMAS } from './apoio';

function porta(usados: string[] = []): PortaServidor {
  let proximo = 900;
  return {
    codigoEmUso: (_c, codigo) => usados.includes(codigo),
    novoCodigo: () => codigoMatriz(proximo++),
    faixasDoDispositivo: () => [],
  };
}

const novaMatriz = { codigo: 'MT-0500', grau_certeza: 'provavel', viveiro_id: VIV_PALMAS, lat: -10.18, lon: -48.33 };

describe('criar', () => {
  it('cria com campos de controle e ignora campos desconhecidos', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'mat000000000001', tipo: 'criar', dados: { ...novaMatriz, hack: 1, versao: 99 } }), null, coletorPalmas, porta());
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar).toMatchObject({ id: 'mat000000000001', versao: 1, criado_por: coletorPalmas.id, codigo: 'MT-0500' });
    expect(d.gravar).not.toHaveProperty('hack');
    expect(d.auditoria?.acao).toBe('criar');
  });

  it('rejeita sem campo obrigatório ou com valor fora da lista', () => {
    expect(resolverOperacao(op({ colecao: 'matriz', registro_id: 'm2', tipo: 'criar', dados: { codigo: 'MT-0501', viveiro_id: VIV_PALMAS } }), null, coletorPalmas, porta()).resultado.status).toBe('rejeitada');
    expect(resolverOperacao(op({ colecao: 'matriz', registro_id: 'm3', tipo: 'criar', dados: { ...novaMatriz, grau_certeza: 'talvez' } }), null, coletorPalmas, porta()).resultado.status).toBe('rejeitada');
  });

  it('rejeita escrita em viveiro sem permissão', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm4', tipo: 'criar', dados: { ...novaMatriz, viveiro_id: VIV_GURUPI } }), null, coletorPalmas, porta());
    expect(d.resultado.status).toBe('rejeitada');
  });

  it('troca código provisório ou repetido por um definitivo', () => {
    const prov = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm5', tipo: 'criar', dados: { ...novaMatriz, codigo: 'MT-P-AB12-1' } }), null, coletorPalmas, porta());
    expect(prov.resultado.codigo_alterado).toEqual({ de: 'MT-P-AB12-1', para: 'MT-0900' });
    const rep = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm6', tipo: 'criar', dados: novaMatriz }), null, coletorPalmas, porta(['MT-0500']));
    expect(rep.gravar?.codigo).toBe('MT-0900');
  });

  it('o pedido do solicitante fica sempre no nome dele', () => {
    const d = resolverOperacao(
      op({ colecao: 'doacao', registro_id: 'doa000000000001', tipo: 'criar', dados: { codigo: 'DO-2026-001', solicitante_pessoa_id: 'p', situacao: 'rascunho', viveiro_id: VIV_PALMAS, solicitante_usuario_id: 'outra-pessoa' } }),
      null,
      solicitante,
      porta(),
    );
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar?.solicitante_usuario_id).toBe(solicitante.id);
  });
});

describe('alterar e conflitos', () => {
  const servidor: Registro = { id: 'm1', versao: 3, viveiro_id: VIV_PALMAS, codigo: 'MT-0500', grau_certeza: 'provavel', altura_m: 10, dap_cm: 30, observacao: 'antes' };

  it('aplica direto quando ninguém mexeu no servidor', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 3, dados: { altura_m: 12 }, base: { altura_m: 10 } }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar).toMatchObject({ altura_m: 12, versao: 4 });
    expect(d.auditoria).toEqual({ acao: 'alterar', antes: { altura_m: 10 }, depois: { altura_m: 12 } });
  });

  it('funde campos diferentes alterados nos dois lados', () => {
    // o servidor mudou a observação (versão 3); o aparelho editou a altura a partir da versão 2
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 2, dados: { altura_m: 12 }, base: { altura_m: 10 } }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar).toMatchObject({ altura_m: 12, observacao: 'antes' });
  });

  it('mesmo campo alterado nos dois lados: vale o servidor e abre conflito', () => {
    const d = resolverOperacao(
      op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 2, dados: { observacao: 'do aparelho', altura_m: 12 }, base: { observacao: 'original', altura_m: 10 } }),
      servidor,
      coletorPalmas,
      porta(),
    );
    expect(d.resultado.status).toBe('conflito');
    expect(d.gravar).toMatchObject({ observacao: 'antes', altura_m: 12 });
    expect(d.conflitos).toEqual([{ campo: 'observacao', valor_base: 'original', valor_aparelho: 'do aparelho', valor_servidor: 'antes' }]);
  });

  it('mesma mudança nos dois lados não é conflito', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 1, dados: { observacao: 'antes' }, base: { observacao: 'x' } }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar).toBeNull();
  });

  it('null no aparelho e 0/"" no servidor contam como iguais', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 1, dados: { altitude: null, descricao_local: null } }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('aplicada');
    expect(d.gravar).toBeNull();
  });

  it('eventos não podem ser alterados, mas reenvio idêntico é aceito', () => {
    const ev: Registro = { id: 'e1', versao: 1, viveiro_id: VIV_PALMAS, lote_mudas_id: 'l', tipo: 'perda', data: '2026-10-01', quantidade: 5 };
    const reenvio = resolverOperacao(op({ colecao: 'evento_lote_mudas', registro_id: 'e1', tipo: 'criar', dados: { lote_mudas_id: 'l', tipo: 'perda', data: '2026-10-01', quantidade: 5, viveiro_id: VIV_PALMAS } }), ev, gestorGeral, porta());
    expect(reenvio.resultado.status).toBe('aplicada');
    expect(reenvio.gravar).toBeNull();
    const muda = resolverOperacao(op({ colecao: 'evento_lote_mudas', registro_id: 'e1', tipo: 'alterar', base_versao: 1, dados: { quantidade: 6 } }), ev, gestorGeral, porta());
    expect(muda.resultado.status).toBe('rejeitada');
  });

  it('não deixa mover o registro para um viveiro sem permissão', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'alterar', base_versao: 3, dados: { viveiro_id: VIV_GURUPI } }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('rejeitada');
  });
});

describe('excluir', () => {
  const servidor: Registro = { id: 'm1', versao: 2, viveiro_id: VIV_PALMAS, codigo: 'MT-0500', grau_certeza: 'certo' };

  it('exclusão é lógica', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'excluir', base_versao: 2 }), servidor, coletorPalmas, porta());
    expect(d.gravar).toMatchObject({ excluido: true, versao: 3, codigo: 'MT-0500' });
  });

  it('não exclui o que outra pessoa alterou depois', () => {
    const d = resolverOperacao(op({ colecao: 'matriz', registro_id: 'm1', tipo: 'excluir', base_versao: 1 }), servidor, coletorPalmas, porta());
    expect(d.resultado.status).toBe('conflito');
    expect(d.gravar).toBeNull();
  });
});
