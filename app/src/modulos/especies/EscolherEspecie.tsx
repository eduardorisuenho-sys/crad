/** Busca de espécie por nome popular ou científico (tolerante a erros). */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { buscarNomes } from '@crads/dominio';
import { useApp } from '../../contexto';
import { indiceBusca } from './dados';

export function EscolherEspecie({ aoEscolher }: { aoEscolher: (especieId: string) => void }) {
  const { db } = useApp();
  const [busca, setBusca] = useState('');
  const indice = useLiveQuery(() => indiceBusca(db), [db]) ?? [];
  const cientificos = useMemo(() => new Map(indice.filter((e) => e.tipo === 'cientifico').map((e) => [e.especie_id, e.nome])), [indice]);
  const achados = useMemo(() => buscarNomes(busca, indice, 12), [busca, indice]);
  return (
    <div className="assistente">
      <input className="campo-busca" type="search" autoFocus placeholder="Nome da árvore (ex.: ipê, baru)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Nome da espécie" />
      <ul className="lista">
        {achados.map((a) => (
          <li key={a.especie_id}>
            <button className="item-lista botao-lista" onClick={() => aoEscolher(a.especie_id)}>
              <div>
                <strong>{a.nome}</strong>
                <small>
                  <i>{cientificos.get(a.especie_id)}</i>
                </small>
              </div>
            </button>
          </li>
        ))}
        {busca && !achados.length && <li className="vazio">Nenhuma espécie com esse nome.</li>}
      </ul>
    </div>
  );
}
