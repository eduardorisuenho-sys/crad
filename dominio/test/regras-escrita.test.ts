import { describe, expect, it } from 'vitest';
import { resolverOperacao, type PortaServidor } from '../src/sync/resolver';
import { op, solicitante, viveiristaPalmas, VIV_PALMAS } from './apoio';

const porta: PortaServidor = { codigoEmUso: () => false, novoCodigo: () => 'X', faixasDoDispositivo: () => [] };
const pedido = { codigo: 'DO-2026-001', solicitante_pessoa_id: 'p', situacao: 'enviada', viveiro_id: VIV_PALMAS };

describe('regras de escrita da doação', () => {
  it('ninguém aprova pedido pela sincronização (precisa reservar no servidor)', () => {
    const atual = { id: 'd', versao: 1, ...pedido, solicitante_usuario_id: solicitante.id };
    const r = resolverOperacao(op({ colecao: 'doacao', registro_id: 'd', tipo: 'alterar', base_versao: 1, dados: { situacao: 'aprovada' } }), atual, viveiristaPalmas, porta);
    expect(r.resultado).toMatchObject({ status: 'rejeitada', motivo: expect.stringMatching(/internet/) });
  });

  it('solicitante envia e cancela, mas não mexe na análise', () => {
    const criar = resolverOperacao(op({ colecao: 'doacao', registro_id: 'd1', tipo: 'criar', dados: pedido }), null, solicitante, porta);
    expect(criar.resultado.status).toBe('aplicada');
    const atual = { ...criar.gravar! };
    expect(resolverOperacao(op({ colecao: 'doacao', registro_id: 'd1', tipo: 'alterar', base_versao: 1, dados: { retirar_ate: '2030-01-01' } }), atual, solicitante, porta).resultado.status).toBe('rejeitada');
    expect(resolverOperacao(op({ colecao: 'doacao', registro_id: 'd1', tipo: 'alterar', base_versao: 1, dados: { situacao: 'retirada' } }), atual, solicitante, porta).resultado.status).toBe('rejeitada');
    expect(resolverOperacao(op({ colecao: 'doacao', registro_id: 'd1', tipo: 'alterar', base_versao: 1, dados: { situacao: 'cancelada' } }), atual, solicitante, porta).resultado.status).toBe('aplicada');
  });

  it('retirada só de pedido aprovado', () => {
    const enviado = { id: 'd', versao: 1, ...pedido };
    expect(resolverOperacao(op({ colecao: 'doacao', registro_id: 'd', tipo: 'alterar', base_versao: 1, dados: { situacao: 'retirada' } }), enviado, viveiristaPalmas, porta).resultado.status).toBe('rejeitada');
    const aprovado = { id: 'd', versao: 2, ...pedido, situacao: 'aprovada' };
    expect(resolverOperacao(op({ colecao: 'doacao', registro_id: 'd', tipo: 'alterar', base_versao: 2, dados: { situacao: 'retirada' } }), aprovado, viveiristaPalmas, porta).resultado.status).toBe('aplicada');
  });

  it('quantidade aprovada e reservas são só do servidor', () => {
    const item = { id: 'i', versao: 1, doacao_id: 'd', especie_id: 'e', qtd_pedida: 10, viveiro_id: VIV_PALMAS };
    expect(resolverOperacao(op({ colecao: 'doacao_item', registro_id: 'i', tipo: 'alterar', base_versao: 1, dados: { qtd_aprovada: 10 } }), item, viveiristaPalmas, porta).resultado.status).toBe('rejeitada');
    expect(resolverOperacao(op({ colecao: 'doacao_item', registro_id: 'i', tipo: 'alterar', base_versao: 1, dados: { qtd_entregue: 8 } }), item, viveiristaPalmas, porta).resultado.status).toBe('aplicada');
    expect(resolverOperacao(op({ colecao: 'reserva', registro_id: 'r', tipo: 'criar', dados: { doacao_item_id: 'i', lote_mudas_id: 'l', quantidade: 5, situacao: 'ativa', viveiro_id: VIV_PALMAS } }), null, viveiristaPalmas, porta).resultado.status).toBe('rejeitada');
    const reserva = { id: 'r', versao: 1, doacao_item_id: 'i', lote_mudas_id: 'l', quantidade: 5, situacao: 'ativa', viveiro_id: VIV_PALMAS };
    expect(resolverOperacao(op({ colecao: 'reserva', registro_id: 'r', tipo: 'alterar', base_versao: 1, dados: { situacao: 'consumida' } }), reserva, viveiristaPalmas, porta).resultado.status).toBe('aplicada');
    expect(resolverOperacao(op({ colecao: 'reserva', registro_id: 'r', tipo: 'alterar', base_versao: 1, dados: { quantidade: 50 } }), reserva, viveiristaPalmas, porta).resultado.status).toBe('rejeitada');
  });
});
