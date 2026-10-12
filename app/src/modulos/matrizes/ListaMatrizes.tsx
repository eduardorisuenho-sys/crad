/** Matrizes do viveiro: busca, fila do gestor e metas por espécie. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { metasPorEspecie, normalizarBusca, parametro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';

type Filtro = 'todas' | 'validar' | 'minhas' | 'metas';
export const ROTULO_VALIDACAO: Record<string, string> = { pendente: 'aguardando gestor', aprovada: 'aprovada', reprovada: 'reprovada' };
export const ROTULO_CERTEZA: Record<string, string> = { certo: 'certo', provavel: 'provável', a_identificar: 'a identificar' };

export function ListaMatrizes() {
  const { db, repo, pode, sessao, viveiroId } = useApp();
  const gestor = pode('validar_matriz');
  const [filtro, setFiltro] = useState<Filtro>(gestor ? 'validar' : 'minhas');
  const [busca, setBusca] = useState('');
  const matrizes = useLiveQuery(() => repo.listar('matriz'), [repo, viveiroId]) ?? [];
  const nomes = useLiveQuery(async () => {
    const m = new Map<string, string>();
    for (const e of await db.colecao('especie').toArray()) m.set(e.id, String(e.nome_cientifico));
    for (const n of await db.colecao('nome_popular').toArray()) if (!n.excluido) m.set(`p:${n.especie_id}`, m.get(`p:${n.especie_id}`) ?? String(n.nome));
    return m;
  }, [db]);
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const meta = parametro<number>(parametros, 'meta_matrizes_por_especie', viveiroId);
  const pendentesValidar = matrizes.filter((m) => m.situacao_validacao !== 'aprovada' && m.situacao_validacao !== 'reprovada').length;

  const nome = (id?: unknown) => (id ? nomes?.get(`p:${id}`) ?? nomes?.get(String(id)) ?? '' : '');
  const lista = useMemo(() => {
    let l = [...matrizes].sort((a, b) => String(b.codigo).localeCompare(String(a.codigo)));
    if (filtro === 'validar') l = l.filter((m) => m.situacao_validacao !== 'aprovada' && m.situacao_validacao !== 'reprovada');
    if (filtro === 'minhas') l = l.filter((m) => m.criado_por === sessao?.id || m.versao === 0);
    if (busca) {
      const q = normalizarBusca(busca);
      l = l.filter((m) => normalizarBusca(`${m.codigo} ${nome(m.especie_id)} ${nomes?.get(String(m.especie_id)) ?? ''}`).includes(q));
    }
    return l;
  }, [matrizes, filtro, busca, nomes]); // eslint-disable-line react-hooks/exhaustive-deps
  const metas = useMemo(() => metasPorEspecie(matrizes as never, meta), [matrizes, meta]);

  return (
    <Tela titulo="Matrizes">
      <div className="acoes">
        <Link to="/matrizes/nova" className="botao-principal">
          <Icone nome="mais" /> Cadastrar matriz
        </Link>
        <Link to="/ler-qr" className="botao-secundario" aria-label="Ler QR code">
          <Icone nome="catalogo" /> Ler QR
        </Link>
      </div>
      <div className="filtros">
        {gestor && (
          <button className={`chip ${filtro === 'validar' ? 'ativo' : ''}`} onClick={() => setFiltro('validar')}>
            Para validar ({pendentesValidar})
          </button>
        )}
        <button className={`chip ${filtro === 'minhas' ? 'ativo' : ''}`} onClick={() => setFiltro('minhas')}>
          Minhas
        </button>
        <button className={`chip ${filtro === 'todas' ? 'ativo' : ''}`} onClick={() => setFiltro('todas')}>
          Todas ({matrizes.length})
        </button>
        <button className={`chip ${filtro === 'metas' ? 'ativo' : ''}`} onClick={() => setFiltro('metas')}>
          Metas
        </button>
      </div>

      {filtro === 'metas' ? (
        <ul className="lista">
          <li className="dica">Meta: {meta} matrizes por espécie.</li>
          {metas.map((m) => (
            <li key={m.especie_id} className="item-lista">
              <div>
                <strong>{nome(m.especie_id)}</strong>
                <progress max={m.meta} value={m.matrizes} aria-label={`${m.matrizes} de ${m.meta}`} />
              </div>
              <span className={m.faltam ? 'selo' : 'selo ok'}>
                {m.matrizes}/{m.meta}
              </span>
            </li>
          ))}
          {!metas.length && <li className="vazio">Nenhuma matriz com espécie definida.</li>}
        </ul>
      ) : (
        <>
          <input className="campo-busca" type="search" placeholder="Código ou espécie" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar matriz" />
          <ul className="lista">
            {lista.map((m) => (
              <li key={m.id}>
                <Link to={`/matrizes/${m.id}`} className="item-lista">
                  <Icone nome="arvore" />
                  <div>
                    <strong>{String(m.codigo)}</strong>
                    <small>{m.especie_id ? nome(m.especie_id) : 'a identificar'}</small>
                  </div>
                  {m.grau_certeza !== 'certo' && <span className="selo">{ROTULO_CERTEZA[String(m.grau_certeza)]}</span>}
                  {m.situacao_validacao === 'aprovada' && <span className="selo ok">aprovada</span>}
                </Link>
              </li>
            ))}
            {!lista.length && <li className="vazio">Nenhuma matriz aqui.</li>}
          </ul>
        </>
      )}
    </Tela>
  );
}
