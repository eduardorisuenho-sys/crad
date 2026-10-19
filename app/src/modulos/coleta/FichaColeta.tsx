/** Ficha da coleta: o que foi colhido, de onde, e o botão para corrigir (editar) ou excluir. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { BotaoExcluir } from '../../componentes/BotaoExcluir';
import { EditarRegistro } from '../../componentes/EditarRegistro';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { mostrarNumero } from '../../plataforma/numero';
import { nomesEspecies } from './dados';

const UNIDADES = [
  { valor: 'kg', rotulo: 'Quilos (kg)' },
  { valor: 'g', rotulo: 'Gramas (g)' },
  { valor: 'litros', rotulo: 'Litros' },
  { valor: 'unidades', rotulo: 'Unidades (contadas)' },
];

export function FichaColeta() {
  const { id } = useParams();
  const { db, pode, sessao } = useApp();
  const c = useLiveQuery(() => db.colecao('coleta').get(id!), [id]);
  const matriz = useLiveQuery(() => (c?.matriz_id ? db.colecao('matriz').get(String(c.matriz_id)) : undefined), [c?.matriz_id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const lote = useLiveQuery(async () => {
    const l = (await db.colecao('lote_sementes_coleta').where('coleta_id').equals(id!).toArray()).find((x) => !x.excluido);
    return l ? String(l.lote_sementes_id) : '';
  }, [id]);
  if (!c) return <Tela titulo="Coleta">{null}</Tela>;
  const especie = String(matriz?.especie_id ?? c.especie_id ?? '');
  return (
    <Tela titulo="Coleta">
      <dl className="ficha" data-testid="ficha-coleta">
        <dt>De onde</dt>
        <dd>{matriz ? `${String(matriz.codigo)} · ${nomes?.get(especie) ?? ''}` : `Sem matriz · ${nomes?.get(especie) ?? ''}`}</dd>
        <dt>Data</dt>
        <dd>{new Date(String(c.data)).toLocaleDateString('pt-BR')}</dd>
        <dt>Colhido</dt>
        <dd>
          {mostrarNumero(c.quantidade)} {UNIDADES.find((u) => u.valor === c.unidade)?.rotulo.toLowerCase() ?? String(c.unidade ?? '')} de {c.material === 'semente' ? 'sementes' : 'frutos'}
        </dd>
        {c.observacao ? (
          <>
            <dt>Observação</dt>
            <dd>{String(c.observacao)}</dd>
          </>
        ) : null}
      </dl>
      {lote && (
        <Link to={`/coleta/lotes/${lote}`} className="botao-secundario">
          Abrir o lote de sementes
        </Link>
      )}
      <EditarRegistro
        colecao="coleta"
        registro={c}
        rotulo="Editar a coleta"
        podeEditar={!!sessao && (sessao.gestorGeral || pode('registrar_coleta', c.viveiro_id) || c.criado_por === sessao.id)}
        campos={[
          ...(c.matriz_id ? [] : [{ nome: 'especie_id', rotulo: 'Espécie', tipo: 'especie' as const }]),
          { nome: 'data', rotulo: 'Data da coleta', tipo: 'data' },
          { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'numero' },
          { nome: 'unidade', rotulo: 'Medida', tipo: 'opcao', opcoes: UNIDADES },
          { nome: 'material', rotulo: 'O que foi colhido', tipo: 'opcao', opcoes: [{ valor: 'fruto', rotulo: 'Frutos' }, { valor: 'semente', rotulo: 'Sementes' }] },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textoLongo' },
        ]}
        depois={lote ? <p className="dica">O lote de sementes já foi formado: se mudar a quantidade, corrija também o peso na ficha do lote (Registrar → Ajuste).</p> : null}
      />
      <BotaoExcluir colecao="coleta" registro={c} voltarPara="/coleta" />
    </Tela>
  );
}
