/** Lista de espécies para o gestor: busca, filtro "para revisar" e importação. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { buscarNomes } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { indiceBusca } from './dados';

export function ListaEspecies() {
  const { db, perfis } = useApp();
  const [busca, setBusca] = useState('');
  const [soRevisar, setSoRevisar] = useState(false);
  const especies = useLiveQuery(async () => (await db.colecao('especie').toArray()).filter((e) => !e.excluido), [db]) ?? [];
  const indice = useLiveQuery(() => indiceBusca(db), [db, especies.length]) ?? [];
  const populares = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of indice) if (e.tipo === 'popular') (m.get(e.especie_id) ?? m.set(e.especie_id, []).get(e.especie_id)!).push(e.nome);
    return m;
  }, [indice]);

  const lista = useMemo(() => {
    let base = especies;
    if (busca.trim()) {
      const achados = buscarNomes(busca, indice, 50);
      const porId = new Map(especies.map((e) => [e.id, e]));
      base = achados.map((a) => porId.get(a.especie_id)!).filter(Boolean);
    } else base = [...especies].sort((a, b) => String(a.nome_cientifico).localeCompare(String(b.nome_cientifico)));
    return soRevisar ? base.filter((e) => e.revisar) : base;
  }, [especies, indice, busca, soRevisar]);

  const paraRevisar = especies.filter((e) => e.revisar).length;
  const gestor = perfis.includes('gestor');

  return (
    <Tela titulo="Espécies">
      <input className="campo-busca" type="search" placeholder="Buscar por nome popular ou científico" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar espécie" />
      <div className="filtros">
        <span>{especies.length} espécies</span>
        {paraRevisar > 0 && (
          <button className={`chip ${soRevisar ? 'ativo' : ''}`} onClick={() => setSoRevisar(!soRevisar)}>
            <Icone nome="aviso" tamanho={18} /> {paraRevisar} para revisar
          </button>
        )}
      </div>
      {gestor && (
        <div className="acoes">
          <Link to="/especies/importar" className="botao-secundario">
            <Icone nome="mais" /> Importar
          </Link>
          <Link to="/especies/nova" className="botao-secundario">
            <Icone nome="mais" /> Nova espécie
          </Link>
        </div>
      )}
      <ul className="lista">
        {lista.slice(0, 200).map((e) => (
          <li key={e.id}>
            <Link to={`/especies/${e.id}`} className="item-lista">
              <div>
                <strong>{(populares.get(e.id) ?? [])[0] ?? <em>sem nome popular</em>}</strong>
                <small>
                  <i>{String(e.nome_cientifico)}</i> · {String(e.familia ?? '')}
                </small>
              </div>
              {Boolean(e.revisar) && <span className="selo">revisar</span>}
              {Boolean(e.ficticia) && <span className="selo">fictícia</span>}
            </Link>
          </li>
        ))}
        {!lista.length && <li className="vazio">{busca ? 'Nenhuma espécie com esse nome.' : 'Nenhuma espécie cadastrada. Use "Importar".'}</li>}
      </ul>
    </Tela>
  );
}
