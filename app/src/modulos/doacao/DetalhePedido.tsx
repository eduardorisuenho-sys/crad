/** Ficha do pedido: itens, análise (com internet), Plantando Água, retirada e PDFs. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { bloqueioRetirada, SITUACOES_APROVADAS, SITUACOES_EM_ANALISE } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { BotaoPlantandoAgua } from './BotaoPlantandoAgua';
import { disponivelLocal, doacoesNoPrograma, itensDoPedido, ROTULO_SITUACAO } from './dados';
import { abrirPdf, relatorioPedido, termoDoacao, type DadosPdf } from './pdf';

const data = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR') : '');

export function DetalhePedido() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { db, repo, perfis, pode, sessao, sincronizar, online } = useApp();
  const doacao = useLiveQuery(() => db.colecao('doacao').get(id!), [id]);
  const itens = useLiveQuery(() => itensDoPedido(db, id!), [id]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const pessoa = useLiveQuery(() => (doacao ? db.colecao('pessoa').get(String(doacao.solicitante_pessoa_id)) : undefined), [doacao?.solicitante_pessoa_id]);
  const viveiro = useLiveQuery(() => (doacao ? db.colecao('viveiro').get(String(doacao.viveiro_id)) : undefined), [doacao?.viveiro_id]);
  const disp = useLiveQuery(() => (doacao ? disponivelLocal(db, String(doacao.viveiro_id)) : undefined), [doacao?.viveiro_id]);
  const instalacao = useLiveQuery(async () => (await db.colecao('instalacao').toArray())[0], [db]);
  const noPrograma = useLiveQuery(() => doacoesNoPrograma(db), [db]);
  const retirada = useLiveQuery(async () => (doacao ? (await db.colecao('retirada').where('doacao_id').equals(doacao.id).toArray()).find((r) => !r.excluido) : undefined), [doacao?.id]);

  const [analisando, setAnalisando] = useState(false);
  const [aprovadas, setAprovadas] = useState<Record<string, string>>({});
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!doacao) return <Tela titulo="Pedido">{null}</Tela>;
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const situacao = String(doacao.situacao);
  const podeAnalisar = pode('aprovar_doacao', doacao.viveiro_id) && SITUACOES_EM_ANALISE.includes(situacao) && doacao.versao !== 0;
  const bloqueio = bloqueioRetirada({ situacao: doacao.situacao, retirar_ate: doacao.retirar_ate }, new Date().toISOString());

  function dadosPdf(): DadosPdf {
    return {
      orgao: String(instalacao?.nome_orgao ?? 'Secretaria do Meio Ambiente e Recursos Hídricos do Tocantins'),
      codigo: String(doacao!.codigo),
      viveiro: String(viveiro?.nome ?? ''),
      solicitante: String(pessoa?.nome ?? ''),
      instituicao: String(doacao!.instituicao ?? ''),
      finalidade: String(doacao!.finalidade ?? ''),
      local: String(doacao!.local_plantio ?? ''),
      area_ha: (doacao!.area_ha as number) || null,
      data: new Date().toLocaleDateString('pt-BR'),
      programa: noPrograma?.has(doacao!.id) ? 'Plantando Água' : undefined,
      textoTermo: instalacao?.texto_termo_doacao ? String(instalacao.texto_termo_doacao) : undefined,
      itens: itens.map((i) => ({
        especie: nomes?.get(String(i.especie_id)) ?? '',
        pedida: Number(i.qtd_pedida ?? 0),
        aprovada: SITUACOES_EM_ANALISE.includes(situacao) ? undefined : Number(i.qtd_aprovada ?? 0),
        entregue: situacao === 'retirada' ? Number(i.qtd_entregue ?? 0) : undefined,
      })),
    };
  }

  async function analisar(aprovar: boolean) {
    setErro('');
    setEnviando(true);
    try {
      const corpo = {
        itens: itens.map((i) => ({ item_id: i.id, qtd_aprovada: aprovar ? Number(aprovadas[i.id] ?? Math.min(Number(i.qtd_pedida), disp?.get(String(i.especie_id)) ?? 0)) : 0 })),
        justificativa,
      };
      const r = await fetch(`${sessao!.servidor}/api/crads/doacao/${id}/analisar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: sessao!.token },
        body: JSON.stringify(corpo),
      }).catch(() => null);
      if (!r) throw new Error('Sem internet. A análise precisa de conexão para reservar as mudas.');
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? 'Não foi possível salvar a análise.');
      await sincronizar();
      setAnalisando(false);
      setMsg(aprovar ? 'Pedido aprovado e mudas reservadas.' : 'Pedido recusado.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela titulo={`Pedido ${String(doacao.codigo)}`}>
      {params.get('novo') && <p className="mensagem">Pedido registrado.{doacao.versao === 0 ? ' Ele vai para análise quando houver sinal.' : ''}</p>}
      {msg && <p className="mensagem">{msg}</p>}
      <dl className="ficha" data-testid="resumo-pedido">
        <dt>Situação</dt>
        <dd>
          {ROTULO_SITUACAO[situacao] ?? situacao}
          {doacao.retirar_ate && SITUACOES_APROVADAS.includes(situacao) ? ` · retirar até ${data(doacao.retirar_ate)}` : ''}
        </dd>
        {doacao.justificativa ? (
          <>
            <dt>Observação da análise</dt>
            <dd>{String(doacao.justificativa)}</dd>
          </>
        ) : null}
        <dt>Solicitante</dt>
        <dd>
          {String(pessoa?.nome ?? '')}
          {doacao.instituicao ? ` · ${String(doacao.instituicao)}` : ''}
        </dd>
        <dt>Plantio</dt>
        <dd>{[doacao.finalidade, doacao.local_plantio].filter(Boolean).map(String).join(' · ')}</dd>
        <dt>Viveiro</dt>
        <dd>{String(viveiro?.nome ?? '')}</dd>
      </dl>

      <section className="cartao">
        <h2>Mudas</h2>
        <table className="tabela" data-testid="itens-pedido">
          <thead>
            <tr>
              <th>Espécie</th>
              <th>Pedidas</th>
              <th>Aprovadas</th>
              <th>Entregues</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id}>
                <td>{nomes?.get(String(i.especie_id)) ?? ''}</td>
                <td>{String(i.qtd_pedida ?? 0)}</td>
                <td>{SITUACOES_EM_ANALISE.includes(situacao) ? '—' : String(i.qtd_aprovada ?? 0)}</td>
                <td>{String(i.qtd_entregue ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pode('plantando_agua', doacao.viveiro_id) && <BotaoPlantandoAgua doacao={doacao} editavel={situacao !== 'cancelada'} />}

      {podeAnalisar && !analisando && (
        <button className="botao-principal" onClick={() => setAnalisando(true)}>
          <Icone nome="certo" /> Analisar pedido
        </button>
      )}
      {analisando && (
        <section className="cartao formulario">
          <h2>Análise</h2>
          {!online && <p className="mensagem alerta">A análise precisa de internet para reservar as mudas.</p>}
          {itens.map((i) => {
            const d = disp?.get(String(i.especie_id)) ?? 0;
            const sugerido = Math.min(Number(i.qtd_pedida), d);
            return (
              <label key={i.id}>
                {nomes?.get(String(i.especie_id)) ?? ''} · pediu {String(i.qtd_pedida)} · disponível {d}
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={Math.min(Number(i.qtd_pedida), d)}
                  aria-label={`Aprovar de ${nomes?.get(String(i.especie_id)) ?? ''}`}
                  value={aprovadas[i.id] ?? String(sugerido)}
                  onChange={(e) => setAprovadas({ ...aprovadas, [i.id]: e.target.value })}
                />
              </label>
            );
          })}
          <label>
            Observação (obrigatória para recusar)
            <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </label>
          {erro && <p className="erro">{erro}</p>}
          <div className="acoes">
            <button className="botao-secundario" disabled={enviando} onClick={() => void analisar(false)}>
              Recusar
            </button>
            <button className="botao-principal" disabled={enviando} onClick={() => void analisar(true)}>
              Aprovar e reservar
            </button>
          </div>
        </section>
      )}

      {pode('retirada', doacao.viveiro_id) && SITUACOES_APROVADAS.includes(situacao) && (
        <>
          {bloqueio ? (
            <p className="mensagem alerta">{bloqueio}</p>
          ) : (
            <Link to={`/doacao/${id}/retirada`} className="botao-principal">
              <Icone nome="doacao" /> Registrar retirada
            </Link>
          )}
        </>
      )}

      <div className="acoes">
        <button className="botao-secundario" onClick={async () => abrirPdf(await relatorioPedido(dadosPdf()), `pedido-${String(doacao.codigo)}.pdf`)}>
          Relatório do pedido (PDF)
        </button>
        {situacao === 'retirada' && (
          <button
            className="botao-secundario"
            onClick={async () => {
              const ass = retirada ? (await db._arquivos.where('registro_id').equals(retirada.id).toArray()).find((a) => a.campo === 'assinatura')?.blob : null;
              abrirPdf(await termoDoacao({ ...dadosPdf(), recebedor: String(retirada?.recebedor_nome ?? ''), assinatura: ass ?? null, entreguePor: sessao?.nome }), `termo-${String(doacao.codigo)}.pdf`);
            }}
          >
            Termo de doação (PDF)
          </button>
        )}
      </div>

      {situacao === 'retirada' && (
        <Link to="/pos-plantio" className="botao-secundario">
          <Icone nome="plantio" /> Pós-plantio
        </Link>
      )}

      {!equipe && SITUACOES_EM_ANALISE.includes(situacao) && (
        <button
          className="botao-secundario"
          onClick={async () => {
            if (confirm('Cancelar este pedido?')) await repo.salvar('doacao', { situacao: 'cancelada' }, id);
          }}
        >
          Cancelar pedido
        </button>
      )}
    </Tela>
  );
}
