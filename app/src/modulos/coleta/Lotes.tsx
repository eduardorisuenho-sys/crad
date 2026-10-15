/** Lotes de sementes: cada coleta vira um lote sozinha (no servidor); aqui é a lista. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { parametro, saldoSementes, situacaoValidade } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from './dados';

export const ROTULO_VALIDADE: Record<string, string> = { vencido: 'vencido', vence_logo: 'vence logo', ok: '', sem_validade: '' };

export function ListaLotes() {
  const { repo, db, viveiroId, pode } = useApp();
  const lotes = useLiveQuery(async () => (await repo.listar('lote_sementes')).sort((a, b) => String(b.codigo).localeCompare(String(a.codigo))), [repo, viveiroId]) ?? [];
  const movs = useLiveQuery(() => repo.listar('movimento_sementes'), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const enderecos = useLiveQuery(async () => new Map((await repo.listar('endereco_armazenamento')).map((e) => [e.id, e])), [repo]);
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const aviso = parametro<number>(parametros, 'aviso_validade_sementes_dias', viveiroId);
  const hoje = new Date().toISOString();

  return (
    <Tela titulo="Lotes de sementes">
      <p className="dica">Cada coleta vira um lote de sementes sozinha quando chega ao servidor (sem precisar formar nem aprovar). Toque no lote para pesar as sementes limpas, guardar ou semear.</p>
      {pode('lotes_sementes') && (
        <>
          <Link to="/coleta/lotes/sementes-iniciais" className="botao-grande">
            <Icone nome="semente" tamanho={36} />
            <span>
              Sementes que já estavam aqui<small className="dica-botao">Sementes guardadas antes do app, sem matriz</small>
            </span>
          </Link>
        </>
      )}
      <ul className="lista">
        {lotes.map((l) => {
          const saldo = saldoSementes(movs.filter((m) => m.lote_sementes_id === l.id) as never);
          const val = situacaoValidade(l.validade as string, hoje, aviso);
          return (
            <li key={l.id}>
              <Link to={`/coleta/lotes/${l.id}`} className="item-lista">
                <Icone nome="semente" />
                <div>
                  <strong>
                    {String(l.codigo)} · {nomes?.get(String(l.especie_id)) ?? ''}
                  </strong>
                  <small>
                    {saldo.g} g · {String(enderecos?.get(String(l.endereco_id))?.codigo ?? 'sem endereço')}
                  </small>
                </div>
                {ROTULO_VALIDADE[val] && <span className="selo">{ROTULO_VALIDADE[val]}</span>}
              </Link>
            </li>
          );
        })}
        {!lotes.length && <li className="vazio">Nenhum lote ainda.</li>}
      </ul>
    </Tela>
  );
}
