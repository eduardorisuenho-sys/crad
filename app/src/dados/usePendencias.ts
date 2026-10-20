/** Pendências da pessoa por módulo (número vermelho no botão da tela inicial). Funciona sem internet. */
import { useLiveQuery } from 'dexie-react-hooks';
import { pedidosQueEsperam, pendencias, type Pendencias } from '@crads/dominio';
import { useApp } from '../contexto';

export function usePendencias(): Pendencias {
  const { db, sessao, pode, matriz, viveiroId } = useApp();
  return (
    useLiveQuery(async () => {
      if (!sessao) return {};
      const ler = (c: string) => db.colecao(c).toArray();
      const [doacoes, itens, baixas, plantios, matrizes, especies, pedidosAcesso, lotesSementes, movimentosSementes, lotesMudas, movimentosMudas, inventarios, monitoramentos] = await Promise.all(
        ['doacao', 'doacao_item', 'doacao_item_lote', 'plantio', 'matriz', 'especie', 'pedido_acesso', 'lote_sementes', 'movimento_sementes', 'lote_mudas', 'movimento_estoque_mudas', 'inventario', 'monitoramento'].map(ler),
      );
      return pendencias(
        { doacoes, itens, baixas, plantios, matrizes, especies, pedidosAcesso, lotesSementes, movimentosSementes, lotesMudas, movimentosMudas, inventarios, monitoramentos, hoje: new Date().toISOString().slice(0, 10) },
        { usuarioId: sessao.id, pode, viveiroId: viveiroId ?? undefined },
      );
    // `pode` muda a cada render; o que ele usa é a sessão, a tabela de permissões e o viveiro
    }, [db, sessao, matriz, viveiroId]) ?? {}
  );
}

/** Pedidos de mudas que esperam ação desta pessoa: marcados na lista com "Precisa de você". */
export function usePedidosQueEsperam(): Set<string> {
  const { db, sessao, pode, matriz, viveiroId } = useApp();
  return (
    useLiveQuery(async () => {
      if (!sessao) return new Set<string>();
      const [doacoes, itens, baixas] = await Promise.all(['doacao', 'doacao_item', 'doacao_item_lote'].map((c) => db.colecao(c).toArray()));
      return pedidosQueEsperam({ doacoes, itens, baixas }, { usuarioId: sessao.id, pode, viveiroId: viveiroId ?? undefined });
    }, [db, sessao, matriz, viveiroId]) ?? new Set<string>()
  );
}
