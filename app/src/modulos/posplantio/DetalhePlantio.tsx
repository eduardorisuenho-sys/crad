/** Plantio: sobrevivência, fotos (com conferência pelo GPS) e acompanhamentos. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { conferirFoto, parametro, pontoDoPlantio } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { resumoPlantio } from './dados';
import { mostrarNumero } from '../../plataforma/numero';

const data = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') : '');

export function DetalhePlantio() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, perfis } = useApp();
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const plantio = useLiveQuery(() => db.colecao('plantio').get(id!), [id]);
  const doacao = useLiveQuery(() => (plantio ? db.colecao('doacao').get(String(plantio.doacao_id)) : undefined), [plantio?.doacao_id]);
  const resumo = useLiveQuery(() => resumoPlantio(db, id!), [id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const fotos = useLiveQuery(async () => {
    const ids = new Set([id!, ...(resumo?.monitoramentos ?? []).map((m) => m.id)]);
    return (await db.colecao('foto').toArray()).filter((f) => !f.excluido && ids.has(String(f.registro_id)));
  }, [id, resumo?.monitoramentos.length]) ?? [];
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];

  if (!plantio || !resumo) return <Tela titulo="Plantio">{null}</Tela>;
  const s = resumo.sobrevivencia;
  const local = pontoDoPlantio(plantio.geometria);
  const distMax = parametro<number>(parametros, 'distancia_max_foto_plantio_m', String(plantio.viveiro_id));

  return (
    <Tela titulo={`Plantio ${String(doacao?.codigo ?? '')}`}>
      {params.get('novo') && <p className="mensagem">Plantio registrado. Obrigado!</p>}
      {params.get('acompanhado') && <p className="mensagem">Acompanhamento registrado.</p>}
      <dl className="ficha" data-testid="sobrevivencia">
        <dt>Mudas plantadas</dt>
        <dd>{s.plantadas}</dd>
        <dt>Sobrevivência</dt>
        <dd>{s.taxa === null ? 'ainda sem acompanhamento' : `${mostrarNumero(s.taxa)}% (${s.vivas} vivas, ${s.tipo === 'vistoria' ? 'vistoria' : 'relato'} de ${data(s.data)})`}</dd>
        <dt>Plantado em</dt>
        <dd>
          {data(plantio.data)}
          {plantio.local ? ` · ${String(plantio.local)}` : ''}
        </dd>
        <dt>Local</dt>
        <dd>{local ? `${local.lat.toFixed(5)}, ${local.lon.toFixed(5)}` : 'sem ponto de GPS'}</dd>
      </dl>
      <section className="cartao">
        <h2>Por espécie</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Espécie</th>
              <th>Plantadas</th>
              <th>Vivas</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {s.por_especie.map((e) => (
              <tr key={e.especie_id}>
                <td>{nomes?.get(e.especie_id) ?? ''}</td>
                <td>{e.plantadas}</td>
                <td>{s.taxa === null ? '—' : e.vivas}</td>
                <td>{e.taxa === null ? '—' : mostrarNumero(e.taxa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="acoes">
        <Link to={`/pos-plantio/${id}/acompanhamento`} className="botao-principal">
          <Icone nome="plantio" /> Novo acompanhamento
        </Link>
        {equipe && (
          <Link to={`/pos-plantio/${id}/acompanhamento?tipo=vistoria`} className="botao-secundario">
            Vistoria
          </Link>
        )}
      </div>
      {fotos.length > 0 && (
        <section className="cartao">
          <h2>Fotos</h2>
          <div className="galeria">
            {fotos.map((f) => {
              const aviso = conferirFoto({ lat: f.lat, lon: f.lon }, local, distMax);
              return (
                <figure key={f.id}>
                  <Miniatura fotoId={f.id} alt="Foto do plantio" />
                  <figcaption className={aviso ? 'alerta-texto' : ''} data-testid="legenda-foto">
                    {aviso ? `conferir: ${aviso}` : data(f.tirada_em)}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}
      {resumo.monitoramentos.length > 0 && (
        <section className="cartao">
          <h2>Acompanhamentos</h2>
          <ul className="historico">
            {resumo.monitoramentos.map((m) => (
              <li key={m.id}>
                {data(m.data)}: {m.tipo === 'vistoria' ? 'vistoria' : 'relato'}
                {m.observacao ? ` · ${String(m.observacao)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Tela>
  );
}
