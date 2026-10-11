/** Junta os registros do aparelho para os relatórios (funciona sem internet). */
import type { DadosRelatorio, Registro } from '@crads/dominio';
import type { BancoCrads } from '../../dados/db';

export async function carregarDadosRelatorio(db: BancoCrads): Promise<DadosRelatorio> {
  const t = async (n: string) => (await db.colecao(n).toArray()).filter((r: Registro) => !r.excluido);
  const [viveiros, especies, nomesPopulares, matrizes, coletas, lotesSementes, ligacoes, movSementes, lotesMudas, eventosMudas, movMudas, doacoes, doacaoItens, doacaoItemLotes, historicoProgramas, plantios, plantioItens, monitoramentos, monitoramentoItens] =
    await Promise.all(
      [
        'viveiro',
        'especie',
        'nome_popular',
        'matriz',
        'coleta',
        'lote_sementes',
        'lote_sementes_coleta',
        'movimento_sementes',
        'lote_mudas',
        'evento_lote_mudas',
        'movimento_estoque_mudas',
        'doacao',
        'doacao_item',
        'doacao_item_lote',
        'doacao_programa_historico',
        'plantio',
        'plantio_item',
        'monitoramento',
        'monitoramento_item',
      ].map(t),
    );
  return { viveiros, especies, nomesPopulares, matrizes, coletas, lotesSementes, ligacoes, movSementes, lotesMudas, eventosMudas, movMudas, doacoes, doacaoItens, doacaoItemLotes, historicoProgramas, plantios, plantioItens, monitoramentos, monitoramentoItens };
}

export function nomesDe(d: DadosRelatorio): Map<string, string> {
  const m = new Map(d.especies.map((e) => [e.id, String(e.nome_cientifico)]));
  const vistos = new Set<string>();
  for (const n of d.nomesPopulares) if (!vistos.has(String(n.especie_id))) {
    vistos.add(String(n.especie_id));
    m.set(String(n.especie_id), String(n.nome));
  }
  return m;
}

export function baixar(conteudo: Blob, nome: string) {
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
