/** Módulo 2: coleta em campo, lotes de sementes e armazenamento. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from './dados';

export function InicioColeta() {
  const { repo, db, perfis, sessao, pode } = useApp();
  const equipeViveiro = perfis.includes('viveirista') || perfis.includes('gestor');
  const coletas = useLiveQuery(async () => (await repo.listar('coleta')).sort((a, b) => String(b.data).localeCompare(String(a.data))), [repo]) ?? [];
  const matrizes = useLiveQuery(async () => new Map((await repo.listar('matriz')).map((m) => [m.id, m])), [repo]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [params] = useSearchParams();
  const minhas = coletas.filter((c) => c.coletor_id === sessao?.id || c.versao === 0).slice(0, 10);

  return (
    <Tela titulo="Coleta e sementes">
      {params.get('salva') && <p className="mensagem">Coleta salva. Vai para o servidor quando houver sinal.</p>}
      <div className="lista-grande">
        {pode('registrar_coleta') && (
          <Link to="/coleta/nova" className="botao-grande">
            <Icone nome="semente" tamanho={40} />
            <span>Registrar coleta</span>
          </Link>
        )}
        <Link to="/coleta/relatorio" className="botao-grande">
          <Icone nome="relatorio" tamanho={40} />
          <span>Relatório de serviço</span>
        </Link>
        <Link to="/coleta/rota" className="botao-grande">
          <Icone nome="plantio" tamanho={40} />
          <span>Rota de coleta</span>
        </Link>
        {equipeViveiro && (
          <>
            <Link to="/coleta/lotes" className="botao-grande">
              <Icone nome="catalogo" tamanho={40} />
              <span>Lotes de sementes</span>
            </Link>
            <Link to="/coleta/armazenamento" className="botao-grande">
              <Icone nome="viveiro" tamanho={40} />
              <span>Armazenamento</span>
            </Link>
          </>
        )}
      </div>
      {minhas.length > 0 && (
        <section className="cartao">
          <h2>Minhas últimas coletas</h2>
          <ul className="lista">
            {minhas.map((c) => {
              const m = matrizes?.get(String(c.matriz_id));
              return (
                <li key={c.id} className="item-lista">
                  <Icone nome="semente" />
                  <div>
                    <strong>
                      {String(m?.codigo ?? '')} · {nomes?.get(String(m?.especie_id)) ?? ''}
                    </strong>
                    <small>
                      {new Date(String(c.data)).toLocaleDateString('pt-BR')} · {String(c.quantidade ?? '')} {String(c.unidade ?? '')}
                    </small>
                  </div>
                  {c.versao === 0 && <span className="selo">não enviado</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Tela>
  );
}
