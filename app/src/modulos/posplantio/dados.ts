/** Consultas do Módulo 6 (pós-plantio) no aparelho. */
import { sobrevivenciaDoPlantio, type Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);
const de = async (db: BancoCrads, colecao: string, campo: string, valor: string) => ativos(await db.colecao(colecao).where(campo).equals(valor).toArray());

export async function plantiosDaDoacao(db: BancoCrads, doacaoId: string) {
  return de(db, 'plantio', 'doacao_id', doacaoId);
}

/** Tudo de um plantio: itens, acompanhamentos e a sobrevivência atual. */
export async function resumoPlantio(db: BancoCrads, plantioId: string) {
  const itens = await de(db, 'plantio_item', 'plantio_id', plantioId);
  const monitoramentos = (await de(db, 'monitoramento', 'plantio_id', plantioId)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const monItens: Registro[] = [];
  for (const m of monitoramentos) monItens.push(...(await de(db, 'monitoramento_item', 'monitoramento_id', m.id)));
  return { itens, monitoramentos, sobrevivencia: sobrevivenciaDoPlantio(itens as never, monitoramentos as never, monItens as never) };
}

/** Mudas entregues por espécie numa doação. */
export async function entreguesDaDoacao(db: BancoCrads, doacaoId: string): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (const i of await de(db, 'doacao_item', 'doacao_id', doacaoId)) if (Number(i.qtd_entregue ?? 0) > 0) m.set(String(i.especie_id), Number(i.qtd_entregue));
  return m;
}
