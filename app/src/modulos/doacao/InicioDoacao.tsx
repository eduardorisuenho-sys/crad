/** Módulo 5: pedidos de mudas (solicitante vê os seus; equipe vê os do viveiro). */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { SITUACOES_APROVADAS, SITUACOES_EM_ANALISE } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { IconeAgua } from './BotaoPlantandoAgua';
import { doacoesNoPrograma, ROTULO_SITUACAO } from './dados';

type Filtro = 'analisar' | 'retirar' | 'retirados' | 'todos' | 'programa';

export function InicioDoacao() {
  const { db, perfis, sessao, viveiroId } = useApp();
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const [filtro, setFiltro] = useState<Filtro>(equipe ? 'analisar' : 'todos');
  const pedidos = useLiveQuery(async () => {
    const todos = (await db.colecao('doacao').toArray()).filter((d) => !d.excluido);
    return (equipe ? todos.filter((d) => !viveiroId || d.viveiro_id === viveiroId) : todos.filter((d) => d.solicitante_usuario_id === sessao?.id || d.versao === 0)).sort((a, b) =>
      String(b.criado_no_aparelho_em).localeCompare(String(a.criado_no_aparelho_em)),
    );
  }, [db, viveiroId, equipe]);
  const totais = useLiveQuery(async () => {
    const m = new Map<string, number>();
    for (const i of await db.colecao('doacao_item').toArray()) if (!i.excluido) m.set(String(i.doacao_id), (m.get(String(i.doacao_id)) ?? 0) + Number(i.qtd_pedida ?? 0));
    return m;
  }, [db]);
  const programa = useLiveQuery(() => doacoesNoPrograma(db), [db]);
  const pessoas = useLiveQuery(async () => new Map((await db.colecao('pessoa').toArray()).map((p) => [p.id, String(p.nome)])), [db]);

  const lista = useMemo(
    () =>
      (pedidos ?? []).filter((d) => {
        const s = String(d.situacao);
        if (filtro === 'analisar') return SITUACOES_EM_ANALISE.includes(s);
        if (filtro === 'retirar') return SITUACOES_APROVADAS.includes(s);
        if (filtro === 'retirados') return s === 'retirada';
        if (filtro === 'programa') return programa?.has(d.id);
        return true;
      }),
    [pedidos, filtro, programa],
  );

  return (
    <Tela titulo={equipe ? 'Doação de mudas' : 'Meus pedidos de mudas'}>
      <Link to="/doacao/novo" className="botao-principal">
        <Icone nome="doacao" /> {equipe ? 'Registrar pedido no balcão' : 'Pedir mudas'}
      </Link>
      {equipe && (
        <div className="filtros" role="group" aria-label="Situação">
          {(
            [
              ['analisar', 'Para analisar'],
              ['retirar', 'Aguardando retirada'],
              ['retirados', 'Retirados'],
              ['programa', 'Plantando Água'],
              ['todos', 'Todos'],
            ] as const
          ).map(([id, rot]) => (
            <button key={id} className={`chip ${filtro === id ? 'ativo' : ''}`} onClick={() => setFiltro(id)}>
              {rot}
            </button>
          ))}
        </div>
      )}
      <ul className="lista">
        {lista.map((d) => (
          <li key={d.id}>
            <Link to={`/doacao/${d.id}`} className="item-lista">
              <Icone nome="doacao" />
              <div>
                <strong>{String(d.codigo)}</strong>
                <small>
                  {pessoas?.get(String(d.solicitante_pessoa_id)) ?? ''} · {totais?.get(d.id) ?? 0} mudas
                </small>
              </div>
              {programa?.has(d.id) && (
                <span className="selo-agua" title="Plantando Água">
                  <IconeAgua tamanho={20} />
                </span>
              )}
              <span className={`selo ${d.situacao === 'retirada' || SITUACOES_APROVADAS.includes(String(d.situacao)) ? 'ok' : ''}`}>{ROTULO_SITUACAO[String(d.situacao)] ?? String(d.situacao)}</span>
            </Link>
          </li>
        ))}
        {!lista.length && <li className="vazio">Nenhum pedido aqui.</li>}
      </ul>
    </Tela>
  );
}
