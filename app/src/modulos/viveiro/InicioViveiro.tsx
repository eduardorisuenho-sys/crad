/** Módulo 3: lotes de mudas por fase, com saldo, germinação e atraso. */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { atrasado, dataPrevistaPronta, FASES_MUDA, taxaGerminacao } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { lotesDeMudas, ROTULO_FASE } from './dados';
import { mostrarNumero } from '../../plataforma/numero';

export function InicioViveiro() {
  const { repo, db, viveiroId } = useApp();
  const [fase, setFase] = useState<string>('');
  const lotes = useLiveQuery(() => lotesDeMudas(repo), [repo, viveiroId]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const especies = useLiveQuery(async () => new Map((await db.colecao('especie').toArray()).map((e) => [e.id, e])), [db]);
  const ativos = lotes.filter((l) => l.lote.situacao !== 'encerrado');
  const hoje = new Date().toISOString();

  const porFase = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of ativos) m.set(String(l.lote.fase_atual ?? 'semeadura'), (m.get(String(l.lote.fase_atual ?? 'semeadura')) ?? 0) + l.saldo);
    return m;
  }, [ativos]);
  const prontasPorEspecie = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of ativos) if (l.lote.fase_atual === 'pronta') m.set(String(l.lote.especie_id), (m.get(String(l.lote.especie_id)) ?? 0) + l.saldo);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ativos]);
  const lista = ativos.filter((l) => !fase || (l.lote.fase_atual ?? 'semeadura') === fase);

  return (
    <Tela titulo="Viveiro">
      <div className="acoes">
        <Link to="/viveiro/semeadura" className="botao-principal">
          <Icone nome="muda" /> Nova semeadura
        </Link>
        <Link to="/viveiro/inventario" className="botao-secundario">
          <Icone nome="catalogo" /> Inventário
        </Link>
      </div>
      <div className="filtros" role="group" aria-label="Fases">
        <button className={`chip ${!fase ? 'ativo' : ''}`} onClick={() => setFase('')}>
          Todas
        </button>
        {FASES_MUDA.map((f) => (
          <button key={f} className={`chip ${fase === f ? 'ativo' : ''}`} onClick={() => setFase(f)}>
            {ROTULO_FASE[f]} ({porFase.get(f) ?? 0})
          </button>
        ))}
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
                    {ROTULO_FASE[String(lote.fase_atual ?? 'semeadura')]} · {saldo} mudas{taxa !== null ? ` · germinação ${mostrarNumero(taxa)}%` : ''}
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
