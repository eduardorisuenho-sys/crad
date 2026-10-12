/** Grava o estoque inicial: um lote (origem estoque_inicial) e a entrada das mudas, por espécie. */
import { ORIGEM_ESTOQUE_INICIAL, type ItemEstoqueInicial } from '@crads/dominio';
import type { Repositorio } from '../../dados/repositorio';

export async function cadastrarEstoqueInicial(repo: Repositorio, itens: ItemEstoqueInicial[]): Promise<string[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const ids: string[] = [];
  for (const i of itens.filter((x) => x.quantidade > 0)) {
    // O código definitivo (LM-AAAA-I-NNN) vem do servidor na sincronização.
    const lote = await repo.salvar('lote_mudas', {
      codigo: await repo.codigoProvisorio('LM'),
      origem: ORIGEM_ESTOQUE_INICIAL,
      especie_id: i.especie_id,
      fase_atual: i.fase,
      situacao: 'ativo',
      canteiro: i.canteiro || null,
      observacao_origem: i.observacao || 'Mudas que já estavam no viveiro antes do app (origem das sementes não registrada).',
    });
    await repo.salvar('movimento_estoque_mudas', { lote_mudas_id: lote.id, tipo: 'entrada', quantidade: i.quantidade, data: hoje, referencia: 'estoque inicial' });
    ids.push(lote.id);
  }
  return ids;
}
