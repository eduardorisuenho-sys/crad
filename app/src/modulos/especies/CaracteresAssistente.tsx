/** Na ficha da espécie: marcar as respostas do assistente que valem para ela. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../../contexto';
import { carregarAssistente } from '../assistente/dados';
import { FiguraOpcao } from '../assistente/FiguraOpcao';

export function CaracteresAssistente({ especieId, editavel }: { especieId: string; editavel: boolean }) {
  const { db, repo } = useApp();
  const dados = useLiveQuery(() => carregarAssistente(db), [db]);
  const marcas = useLiveQuery(async () => (await db.colecao('especie_opcao').where('especie_id').equals(especieId).toArray()).filter((m) => !m.excluido), [especieId]) ?? [];
  if (!dados?.perguntas.length) return null;

  async function alternar(opcaoId: string) {
    const m = marcas.find((x) => x.opcao_id === opcaoId);
    if (m) await repo.excluir('especie_opcao', m.id);
    else await repo.salvar('especie_opcao', { especie_id: especieId, opcao_id: opcaoId });
  }

  return (
    <section className="cartao">
      <h2>Características para o assistente</h2>
      <p className="dica">Marque o que vale para esta espécie. Pode marcar mais de uma resposta. Deixe em branco o que não souber.</p>
      {dados.perguntas.map((p) => (
        <fieldset key={p.id} className="meses">
          <legend>{p.texto}</legend>
          {p.opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={!editavel}
              className={`chip ${marcas.some((m) => m.opcao_id === o.id) ? 'ativo' : ''}`}
              onClick={() => void alternar(o.id)}
            >
              <FiguraOpcao nome={o.figura_padrao} tamanho={24} /> {o.rotulo}
            </button>
          ))}
        </fieldset>
      ))}
    </section>
  );
}
