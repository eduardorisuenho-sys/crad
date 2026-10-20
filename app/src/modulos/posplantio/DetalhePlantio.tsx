/** Plantio: sobrevivência, fotos (com conferência pelo GPS) e acompanhamentos. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { conferirFoto, parametro, pontoDoPlantio } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Miniatura } from '../../componentes/Miniatura';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { entreguesDaDoacao, resumoPlantio } from './dados';
import { BotaoPdf } from '../../componentes/BotaoPdf';
import { fotoGuardadaOuBaixada } from '../../dados/arquivos';
import { doacoesNoPrograma } from '../doacao/dados';
import { emailDoTermo, fotoDoBlob, relatorioPlantio } from './relatorioPdf';
import { mostrarNumero } from '../../plataforma/numero';
import { useMarcarVisto } from '../../dados/usePendencias';

const data = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') : '');

export function DetalhePlantio() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, pode, sessao } = useApp();
  // abrir esta tela tira a pendência do número vermelho
  useMarcarVisto(id && `plantio:${id}:`);
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
      <BotaoPdf
        className="botao-principal"
        rotulo="Baixar relatório do plantio (PDF)"
        nome={`relatorio-plantio-${String(doacao?.codigo ?? id)}.pdf`}
        gerar={async (progresso) => {
          const pessoa = doacao ? await db.colecao('pessoa').get(String(doacao.solicitante_pessoa_id)) : undefined;
          const viveiro = await db.colecao('viveiro').get(String(plantio.viveiro_id));
          const entregues = doacao ? await entreguesDaDoacao(db, doacao.id) : new Map<string, number>();
          const monItens = (await db.colecao('monitoramento_item').toArray()).filter((i) => !i.excluido);
          const programa = doacao ? (await doacoesNoPrograma(db)).has(doacao.id) : false;
          const fotosPdf = [];
          for (const [n, f] of fotos.entries()) {
            progresso(n, fotos.length);
            const mon = resumo.monitoramentos.find((m) => m.id === f.registro_id);
            fotosPdf.push({
              imagem: await fotoDoBlob(await fotoGuardadaOuBaixada(db, sessao, f.id)),
              data: f.tirada_em ? new Date(String(f.tirada_em)).toLocaleString('pt-BR') : '',
              lat: typeof f.lat === 'number' ? f.lat : null,
              lon: typeof f.lon === 'number' ? f.lon : null,
              aviso: conferirFoto({ lat: f.lat, lon: f.lon }, local, distMax),
              legenda: mon ? `Acompanhamento de ${data(mon.data)}` : 'Plantio',
            });
          }
          return relatorioPlantio({
            orgao: 'Secretaria do Meio Ambiente e Recursos Hídricos do Tocantins',
            codigo: String(doacao?.codigo ?? ''),
            viveiro: String(viveiro?.nome ?? ''),
            solicitante: String(pessoa?.nome ?? ''),
            instituicao: doacao?.instituicao ? String(doacao.instituicao) : undefined,
            finalidade: doacao?.finalidade ? String(doacao.finalidade) : undefined,
            dataPlantio: data(plantio.data),
            local: plantio.local ? String(plantio.local) : undefined,
            coordenadas: local ? `${local.lat.toFixed(6)}, ${local.lon.toFixed(6)}` : undefined,
            area_ha: doacao?.area_ha ? Number(doacao.area_ha) : null,
            programa: programa ? 'Plantando Água' : undefined,
            especies: s.por_especie.map((e) => ({ nome: nomes?.get(e.especie_id) ?? '', entregues: entregues.get(e.especie_id) ?? 0, plantadas: e.plantadas, vivas: s.taxa === null ? null : e.vivas, taxa: e.taxa })),
            sobrevivencia: s.taxa === null ? 'ainda sem acompanhamento' : `${mostrarNumero(s.taxa)}% (${s.vivas} vivas de ${s.plantadas})`,
            acompanhamentos: [...resumo.monitoramentos].reverse().map((m) => {
              const its = monItens.filter((i) => i.monitoramento_id === m.id);
              return {
                data: data(m.data),
                tipo: m.tipo === 'vistoria' ? 'vistoria' : 'relato de quem plantou',
                observacao: m.observacao ? String(m.observacao) : undefined,
                vivas: its.length ? its.reduce((t, i) => t + Number(i.vivas ?? 0), 0) : null,
                plantadas: its.reduce((t, i) => t + Number(i.plantadas ?? 0), 0),
              };
            }),
            fotos: fotosPdf,
            termoAceitoEm: doacao?.termo_aceito_em ? new Date(String(doacao.termo_aceito_em)).toLocaleDateString('pt-BR') : undefined,
            emailRelatorio: emailDoTermo(doacao?.termo_texto ? String(doacao.termo_texto) : undefined),
          });
        }}
      />
      <div className="acoes">
        <Link to={`/pos-plantio/${id}/acompanhamento`} className="botao-principal">
          <Icone nome="plantio" /> Novo acompanhamento
        </Link>
        {pode('vistoria', plantio?.viveiro_id) && (
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
                  <Miniatura fotoId={f.id} alt="Foto do plantio" data={f} />
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
