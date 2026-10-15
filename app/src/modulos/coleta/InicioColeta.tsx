/**
 * Módulo 2: coleta em campo. Cada coleta vira um lote de sementes sozinha
 * (no servidor); tocar na coleta abre a ficha do lote (pesar, semear,
 * teste de germinação, descarte, etiqueta).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { nomesEspecies } from './dados';

export function InicioColeta() {
  const { repo, db, perfis, sessao, pode } = useApp();
  const equipeViveiro = perfis.includes('viveirista') || perfis.includes('gestor');
  const coletas = useLiveQuery(async () => (await repo.listar('coleta')).sort((a, b) => String(b.data).localeCompare(String(a.data))), [repo]) ?? [];
  const matrizes = useLiveQuery(async () => new Map((await repo.listar('matriz')).map((m) => [m.id, m])), [repo]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [params] = useSearchParams();
  // o viveiro vê as coletas de todos (para pesar e semear); o coletor, as suas
  const minhas = coletas.filter((c) => equipeViveiro || c.coletor_id === sessao?.id || c.versao === 0).slice(0, 10);
  const loteDe = useLiveQuery(async () => {
    const lotes = new Set((await repo.listar('lote_sementes')).map((l) => l.id));
    const ligs = (await db.colecao('lote_sementes_coleta').toArray()).filter((l) => !l.excluido && lotes.has(String(l.lote_sementes_id)));
    return new Map(ligs.map((l) => [String(l.coleta_id), String(l.lote_sementes_id)]));
  }, [repo, db]);

  return (
    <Tela titulo="Coleta e sementes">
      {params.get('salva') && <p className="mensagem">Coleta salva. Quando chegar ao servidor, ela vira um lote de sementes sozinha.</p>}
      <div className="lista-grande">
        {pode('registrar_coleta') && (
          <Link to="/coleta/nova" className="botao-grande verde">
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
      </div>
      {minhas.length > 0 && (
        <section className="cartao">
          <h2>{equipeViveiro ? 'Últimas coletas' : 'Minhas últimas coletas'}</h2>
          <ul className="lista">
            {minhas.map((c) => {
              const m = matrizes?.get(String(c.matriz_id));
              const lote = loteDe?.get(c.id);
              const conteudo = (
                <>
                  <Icone nome="semente" />
                  <div>
                    <strong>
                      {c.matriz_id ? String(m?.codigo ?? '') : 'Sem matriz'} · {nomes?.get(String(m?.especie_id ?? c.especie_id)) ?? ''}
                    </strong>
                    <small>
                      {new Date(String(c.data)).toLocaleDateString('pt-BR')} · {mostrarNumero(c.quantidade)} {String(c.unidade ?? '')}
                    </small>
                  </div>
                  {c.versao === 0 && <span className="selo">não enviado</span>}
                </>
              );
              return (
                <li key={c.id}>
                  {lote ? (
                    <Link to={`/coleta/lotes/${lote}`} className="item-lista">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="item-lista">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Tela>
  );
}
