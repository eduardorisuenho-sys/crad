import { describe, expect, it } from 'vitest';
import type { ContextoUsuario } from '../src/acesso';
import { notificacaoPara } from '../src/notificacoes';

const V = 'v1';
const gestor: ContextoUsuario = { id: 'g', gestorGeral: false, solicitante: false, perfisPorViveiro: { [V]: ['gestor'] } };
const viveirista: ContextoUsuario = { id: 'vv', gestorGeral: false, solicitante: false, perfisPorViveiro: { [V]: ['viveirista'] } };
const solicitante: ContextoUsuario = { id: 's', gestorGeral: false, solicitante: true, perfisPorViveiro: {} };
const coletor: ContextoUsuario = { id: 'c', gestorGeral: false, solicitante: false, perfisPorViveiro: { [V]: ['coletor'] } };
const pedido = { id: 'd1', codigo: 'DO-2026-001', viveiro_id: V, solicitante_usuario_id: 's', criado_por: 's', atualizado_por: 's' };

describe('notificações', () => {
  it('pedido novo avisa quem aprova (não quem pediu, nem o coletor)', () => {
    const d = { ...pedido, situacao: 'enviada' };
    expect(notificacaoPara('doacao', undefined, d, gestor)).toMatchObject({ titulo: 'Novo pedido de mudas', rota: '/doacao/d1' });
    expect(notificacaoPara('doacao', { ...pedido, situacao: 'rascunho' }, d, gestor)?.titulo).toBe('Novo pedido de mudas');
    expect(notificacaoPara('doacao', undefined, d, solicitante)).toBeNull();
    expect(notificacaoPara('doacao', undefined, d, coletor)).toBeNull();
    expect(notificacaoPara('doacao', d, { ...d, versao: 2 }, gestor)).toBeNull(); // já sabia
  });

  it('aprovação avisa quem pediu e quem entrega; recusa só quem pediu', () => {
    const antes = { ...pedido, situacao: 'enviada' };
    const aprovado = { ...antes, situacao: 'aprovada', atualizado_por: 'g' };
    expect(notificacaoPara('doacao', antes, aprovado, solicitante)?.titulo).toBe('Seu pedido de mudas foi aprovado!');
    expect(notificacaoPara('doacao', antes, aprovado, viveirista)?.titulo).toBe('Pedido aprovado');
    expect(notificacaoPara('doacao', antes, aprovado, { ...gestor, id: 'g2' })?.titulo).toBe('Pedido aprovado'); // outro gestor também entrega
    expect(notificacaoPara('doacao', antes, { ...aprovado, atualizado_por: 'g' }, { ...gestor, id: 'g' })).toBeNull(); // foi ele
    const negado = { ...antes, situacao: 'negada', atualizado_por: 'g' };
    expect(notificacaoPara('doacao', antes, negado, solicitante)?.titulo).toMatch(/não foi aprovado/);
    expect(notificacaoPara('doacao', antes, negado, viveirista)).toBeNull();
  });

  it('retirada combinada avisa quem pediu, com o dia', () => {
    const antes = { ...pedido, situacao: 'aprovada', atualizado_por: 'g' };
    const n = notificacaoPara('doacao', antes, { ...antes, retirada_combinada: '2026-12-01', atualizado_por: 'vv' }, solicitante);
    expect(n).toMatchObject({ titulo: 'Retirada combinada', texto: expect.stringContaining('01/12/2026') });
  });

  it('matriz: quem valida é avisado da nova; o coletor, da aprovação ou reprovação', () => {
    const m = { id: 'm1', codigo: 'MT-0001', viveiro_id: V, criado_por: 'c', atualizado_por: 'c', situacao_validacao: 'pendente' };
    expect(notificacaoPara('matriz', undefined, m, gestor)?.titulo).toBe('Nova matriz para validar');
    expect(notificacaoPara('matriz', undefined, m, viveirista)).toBeNull();
    expect(notificacaoPara('matriz', m, { ...m, situacao_validacao: 'aprovada', atualizado_por: 'g' }, coletor)?.titulo).toBe('Matriz aprovada');
    expect(notificacaoPara('matriz', m, { ...m, situacao_validacao: 'reprovada', excluido: true, atualizado_por: 'g' }, coletor)?.titulo).toBe('Matriz reprovada');
  });

  it('pedido de acesso avisa quem cuida da equipe', () => {
    const p = { id: 'p1', viveiro_id: V, nome: 'Fulana', perfil: 'coletor', situacao: 'pendente', criado_por: 'x', atualizado_por: 'x' };
    expect(notificacaoPara('pedido_acesso', undefined, p, gestor)?.titulo).toBe('Novo pedido de acesso');
    expect(notificacaoPara('pedido_acesso', undefined, p, viveirista)).toBeNull();
  });
});
