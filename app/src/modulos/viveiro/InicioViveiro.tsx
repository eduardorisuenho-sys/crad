/** Módulo 3: lotes de mudas (prontas para doação ou em formação), com saldo e germinação. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { atrasado, dataPrevistaPronta, taxaGerminacao } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { lotesDeMudas } from './dados';
import { ForaDoCatalogo } from '../doacao/ForaDoCatalogo';
import { mostrarNumero } from '../../plataforma/numero';

export function InicioViveiro() {
  const { repo, db, viveiroId, pode } = useApp();
  // '' = todas; 'pronta' = prontas para doação; 'formacao' = ainda crescendo
  const [fase, setFase] = useState<'' | 'pronta' | 'formacao'>('');
  const lotes = useLiveQuery(() => lotesDeMudas(repo), [repo, viveiroId]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const especies = useLiveQuery(async () => new Map((await db.colecao('especie').toArray()).map((e) => [e.id, e])), [db]);
  const ativos = lotes.filter((l) => l.lote.situacao !== 'encerrado');
  const hoje = new Date().toISOString();

  const pronta = (l: { lote: Record<string, unknown> }) => l.lote.fase_atual === 'pronta';
  const totalProntas = ativos.filter(pronta).reduce((s, l) => s + l.saldo, 0);
  const totalFormacao = ativos.filter((l) => !pronta(l)).reduce((s, l) => s + l.saldo, 0);
  const prontasPorEspecie = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of ativos) if (l.lote.fase_atual === 'pronta') m.set(String(l.lote.especie_id), (m.get(String(l.lote.especie_id)) ?? 0) + l.saldo);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ativos]);
  const lista = ativos.filter((l) => !fase || (fase === 'pronta') === pronta(l));

  return (
    <Tela titulo="Viveiro">
      <div className="acoes">
        {pode('producao') && (
          <Link to="/viveiro/semeadura" className="botao-principal">
            <Icone nome="muda" /> Nova semeadura
          </Link>
        )}
        {pode('inventario') && (
          <Link to="/viveiro/inventario" className="botao-secundario">
            <Icone nome="catalogo" /> Inventário
          </Link>
        )}
      </div>
      <ForaDoCatalogo />
      {pode('estoque_inicial') && (
        <Link to="/viveiro/estoque-inicial" className="botao-grande">
          <Icone nome="mais" tamanho={36} />
          <span>
            Mudas que já estavam aqui<small className="dica-botao">Cadastrar o estoque de antes do app</small>
          </span>
        </Link>
      )}
      <div className="filtros" role="group" aria-label="Situação">
        <button className={`chip ${!fase ? 'ativo' : ''}`} onClick={() => setFase('')}>
          Todas
        </button>
        <button className={`chip ${fase === 'pronta' ? 'ativo' : ''}`} onClick={() => setFase('pronta')}>
          Prontas para doação ({totalProntas})
        </button>
        {totalFormacao > 0 && (
          <button className={`chip ${fase === 'formacao' ? 'ativo' : ''}`} onClick={() => setFase('formacao')}>
            Em formação ({totalFormacao})
          </button>
        )}
      </div>
      <ul className="lista">
        {lista.map(({ lote, saldo, germinadas }) => {
          const previsao = dataPrevistaPronta(lote.data_semeadura as string, especies?.get(String(lote.especie_id))?.meses_ate_pronta as number);
          const taxa = taxaGerminacao(lote.sementes_semeadas as number, germinadas);
          return (
            <li key={lote.id}>
              <Link to={`/viveiro/lotes/${lote.id}`} className="item-lista">
                <Icone nome="muda" />
                <div>
                  <strong>
                    {String(lote.codigo)} · {nomes?.get(String(lote.especie_id)) ?? ''}
                  </strong>
                  <small>
                    {lote.fase_atual === 'pronta' ? 'Pronta para doação' : 'Em formação'} · {saldo} mudas{taxa !== null ? ` · germinação ${mostrarNumero(taxa)}%` : ''}
                  </small>
                </div>
                {atrasado(previsao, lote.fase_atual as string, hoje) && <span className="selo">atrasado</span>}
                {lote.versao === 0 && <span className="selo">não enviado</span>}
              </Link>
            </li>
          );
        })}
        {!lista.length && <li className="vazio">Nenhum lote de mudas aqui.</li>}
      </ul>
      {prontasPorEspecie.length > 0 && (
        <section className="cartao">
          <h2>Mudas prontas por espécie</h2>
          <ul className="historico">
            {prontasPorEspecie.map(([id, n]) => (
              <li key={id}>
                {nomes?.get(id) ?? id}: <b>{n}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Tela>
  );
}
