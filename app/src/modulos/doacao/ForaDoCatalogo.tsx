/**
 * Aviso: há mudas prontas de espécies que ainda não aparecem para quem pede
 * mudas. Quem cuida das espécies libera com um toque (publica no catálogo).
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { prontasForaDoCatalogo, type Registro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';

const ativos = (rs: Registro[]) => rs.filter((r) => !r.excluido);

export function ForaDoCatalogo() {
  const { db, repo, viveiroId, pode } = useApp();
  const [liberadas, setLiberadas] = useState(0);
  const fora = useLiveQuery(async () => {
    if (!viveiroId) return [];
    const doViveiro = async (n: string) => ativos(await db.colecao(n).where('viveiro_id').equals(viveiroId).toArray());
    return prontasForaDoCatalogo({
      lotesMudas: await doViveiro('lote_mudas'),
      movimentos: await doViveiro('movimento_estoque_mudas'),
      reservas: await doViveiro('reserva'),
      especies: await db.colecao('especie').toArray(),
    });
  }, [db, viveiroId]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);

  if (liberadas) {
    return (
      <p className="mensagem" data-testid="liberadas">
        <Icone nome="certo" tamanho={20} /> {liberadas} espécie(s) liberada(s): as mudas já aparecem para quem pede mudas.
      </p>
    );
  }
  if (!fora?.length) return null;
  const total = fora.reduce((s, f) => s + f.mudas, 0);

  async function liberar() {
    for (const f of fora!) await repo.salvar('especie', { publicada: true }, f.especie_id);
    setLiberadas(fora!.length);
  }

  return (
    <section className="cartao" data-testid="fora-do-catalogo">
      <h2>
        <Icone nome="aviso" tamanho={22} /> {total} mudas prontas ainda não aparecem para doação
      </h2>
      <p className="dica">Estas espécies ainda não estão no catálogo, então quem pede mudas não as vê:</p>
      <ul className="lista">
        {fora.map((f) => (
          <li key={f.especie_id} className="item-lista">
            <Icone nome="muda" />
            <div>
              <strong>{nomes?.get(f.especie_id) ?? f.especie_id}</strong>
              <small>{f.mudas} mudas prontas</small>
            </div>
          </li>
        ))}
      </ul>
      {pode('especies') ? (
        <button className="botao-principal" onClick={() => void liberar()}>
          <Icone nome="certo" /> Liberar para doação
        </button>
      ) : (
        <p className="dica">Peça ao gestor para liberar estas espécies (ele só precisa tocar em “Liberar para doação”).</p>
      )}
    </section>
  );
}
