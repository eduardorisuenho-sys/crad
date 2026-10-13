/**
 * Pedido de mudas, uma coisa por tela. O solicitante pede pelo app; a equipe
 * registra o pedido do balcão. Funciona sem internet (vai para análise depois).
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { bloqueiosPedido, parametro } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { lerPosicao } from '../../plataforma/gps';
import { CAMPO_DECIMAL, lerNumero } from '../../plataforma/numero';
import { servidorPublico } from '../catalogo/api';
import { nomesEspecies } from '../coleta/dados';
import { listaMunicipios, municipioDoNome, municipioDoPonto } from '../municipios/dados';
import { IconeAgua } from './BotaoPlantandoAgua';
import { disponivelLocal, disponivelPublico, FINALIDADES, marcarPrograma } from './dados';

type Etapa = 'viveiro' | 'mudas' | 'plantio' | 'pessoa' | 'conferir';

export function NovoPedido() {
  const { db, repo, perfis, sessao, viveiroId } = useApp();
  const navegar = useNavigate();
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const [etapa, setEtapa] = useState<Etapa>(equipe ? 'mudas' : 'viveiro');
  const [viveiro, setViveiro] = useState<string | undefined>(equipe ? viveiroId : undefined);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [plantio, setPlantio] = useState({ finalidade: '', municipio: '', local: '', area: '', lat: null as number | null, lon: null as number | null });
  const [pessoa, setPessoa] = useState({ nome: equipe ? '' : sessao?.nome ?? '', instituicao: '', tipo: 'fisica', documento: '', telefone: '' });
  const [oficio, setOficio] = useState<File | null>(null);
  const [programa, setPrograma] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [publico, setPublico] = useState<Awaited<ReturnType<typeof disponivelPublico>> | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState('');

  useEffect(() => {
    if (equipe) return;
    disponivelPublico(servidorPublico(sessao?.servidor))
      .then((p) => {
        setPublico(p);
        if (p.viveiros.length === 1) {
          setViveiro(p.viveiros[0].id);
          setEtapa('mudas');
        }
      })
      .catch((e) => setErroCatalogo((e as Error).message));
  }, [equipe, sessao?.servidor]);

  const local = useLiveQuery(() => (equipe && viveiro ? disponivelLocal(db, viveiro) : undefined), [equipe, viveiro]);
  const nomesLocais = useLiveQuery(() => nomesEspecies(db), [db]);
  const municipios = useLiveQuery(() => listaMunicipios(db), [db]) ?? [];
  const parametros = useLiveQuery(() => db.colecao('parametro').toArray(), [db]) ?? [];
  const limite = parametro<number>(parametros, 'limite_mudas_por_especie', viveiro);
  const disponivel = equipe ? local ?? new Map<string, number>() : publico?.porViveiro.get(viveiro ?? '') ?? new Map<string, number>();
  const nomes = equipe ? nomesLocais : publico?.nomes;
  const itens = useMemo(() => Object.entries(quantidades).map(([especie_id, q]) => ({ especie_id, quantidade: lerNumero(q) ?? 0 })).filter((i) => i.quantidade > 0), [quantidades]);
  const total = itens.reduce((s, i) => s + i.quantidade, 0);

  function conferirMudas() {
    const b = bloqueiosPedido(itens, disponivel, limite, nomes);
    setErros(b);
    if (!b.length) setEtapa('plantio');
  }

  async function salvar() {
    setSalvando(true);
    const p = await repo.salvar('pessoa', { nome: pessoa.nome.trim(), tipo: pessoa.tipo, instituicao: pessoa.instituicao || null, ...(equipe ? {} : { usuario_id: sessao?.id }) });
    // LGPD: CPF/CNPJ e telefone ficam na tabela que só o gestor lê.
    if (pessoa.documento.trim() || pessoa.telefone.trim()) await repo.salvar('dados_pessoais', { pessoa_id: p.id, documento: pessoa.documento.trim() || null, telefone: pessoa.telefone.trim() || null });
    const codigo = await repo.proximoCodigo('DO');
    const ponto = plantio.lat !== null ? { lat: plantio.lat, lon: plantio.lon! } : null;
    const municipio = (await municipioDoNome(db, plantio.municipio)) ?? (await municipioDoPonto(db, ponto));
    const doacao = await repo.salvar('doacao', {
      codigo,
      viveiro_id: viveiro,
      solicitante_pessoa_id: p.id,
      solicitante_usuario_id: equipe ? null : sessao?.id,
      instituicao: pessoa.instituicao || null,
      finalidade: plantio.finalidade || null,
      municipio_plantio_id: municipio?.id ?? null,
      local_plantio: [plantio.municipio, plantio.local].filter(Boolean).join(' · ') || null,
      geometria_plantio: plantio.lat !== null ? { type: 'Point', coordinates: [plantio.lon, plantio.lat] } : null,
      area_ha: lerNumero(plantio.area),
      canal: equipe ? 'balcao' : 'online',
      situacao: 'enviada',
    });
    for (const i of itens) await repo.salvar('doacao_item', { doacao_id: doacao.id, especie_id: i.especie_id, qtd_pedida: i.quantidade, viveiro_id: viveiro, ...(equipe ? {} : { solicitante_usuario_id: sessao?.id }) });
    if (oficio) await repo.anexarArquivo('doacao', doacao.id, 'oficio', oficio, oficio.name);
    if (programa) await marcarPrograma(db, repo, doacao, true, sessao?.nome ?? '');
    navegar(`/doacao/${doacao.id}?novo=1`, { replace: true });
  }

  const voltar = (para: Etapa) => (
    <button type="button" className="botao-secundario" onClick={() => setEtapa(para)}>
      <Icone nome="voltar" /> Voltar
    </button>
  );

  return (
    <Tela titulo={equipe ? 'Pedido no balcão' : 'Pedir mudas'}>
      {etapa === 'viveiro' && (
        <div className="assistente">
          <h2 className="pergunta">De qual viveiro?</h2>
          {erroCatalogo && <p className="erro">{erroCatalogo}</p>}
          {!publico && !erroCatalogo && <p className="vazio">Carregando o catálogo…</p>}
          <div className="lista-grande">
            {publico?.viveiros.map((v) => (
              <button
                key={v.id}
                className="botao-grande"
                onClick={() => {
                  setViveiro(v.id);
                  setEtapa('mudas');
                }}
              >
                <Icone nome="viveiro" tamanho={40} />
                <span>{v.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {etapa === 'mudas' && (
        <div className="assistente">
          <h2 className="pergunta">Quais mudas e quantas?</h2>
          <p className="dica">Até {limite} mudas de cada espécie.</p>
          <ul className="lista">
            {[...disponivel.entries()]
              .filter(([, d]) => d > 0)
              .sort((a, b) => (nomes?.get(a[0]) ?? '').localeCompare(nomes?.get(b[0]) ?? '', 'pt-BR'))
              .map(([id, d]) => (
                <li key={id} className="item-lista">
                  <div>
                    <strong>{nomes?.get(id) ?? id}</strong>
                    <small>{d} disponíveis</small>
                  </div>
                  <input
                    className="campo-contagem"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={Math.min(d, limite)}
                    step="1"
                    aria-label={`Quantidade de ${nomes?.get(id) ?? id}`}
                    value={quantidades[id] ?? ''}
                    onChange={(e) => setQuantidades({ ...quantidades, [id]: e.target.value })}
                  />
                </li>
              ))}
            {![...disponivel.values()].some((d) => d > 0) && <li className="vazio">Não há mudas prontas neste viveiro agora.</li>}
          </ul>
          {erros.map((e) => (
            <p key={e} className="erro">
              {e}
            </p>
          ))}
          <button className="botao-principal" onClick={conferirMudas}>
            Continuar ({total} mudas)
          </button>
          {!equipe && voltar('viveiro')}
        </div>
      )}

      {etapa === 'plantio' && (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            setEtapa('pessoa');
          }}
        >
          <h2 className="pergunta">Onde vão ser plantadas?</h2>
          <fieldset className="meses">
            <legend>Para quê</legend>
            {FINALIDADES.map((f) => (
              <button type="button" key={f} className={`chip ${plantio.finalidade === f ? 'ativo' : ''}`} onClick={() => setPlantio({ ...plantio, finalidade: f })}>
                {f}
              </button>
            ))}
          </fieldset>
          <label>
            Município
            <input required value={plantio.municipio} onChange={(e) => setPlantio({ ...plantio, municipio: e.target.value })} list="lista-municipios" />
          </label>
          <datalist id="lista-municipios">
            {municipios.map((m) => (
              <option key={m.id} value={String(m.nome)} />
            ))}
          </datalist>
          <label>
            Endereço ou como chegar
            <input value={plantio.local} onChange={(e) => setPlantio({ ...plantio, local: e.target.value })} />
          </label>
          <button
            type="button"
            className="botao-secundario"
            onClick={async () => {
              const p = await lerPosicao(6000);
              if (!p) return;
              const m = plantio.municipio ? null : await municipioDoPonto(db, p);
              setPlantio({ ...plantio, lat: p.lat, lon: p.lon, municipio: plantio.municipio || String(m?.nome ?? '') });
            }}
          >
            <Icone nome="plantio" /> {plantio.lat !== null ? `Ponto marcado (${plantio.lat.toFixed(4)}, ${plantio.lon!.toFixed(4)})` : 'Estou no local: marcar o ponto'}
          </button>
          <label>
            Área aproximada (hectares, opcional)
            <input {...CAMPO_DECIMAL} value={plantio.area} onChange={(e) => setPlantio({ ...plantio, area: e.target.value })} />
          </label>
          <button className="botao-principal">Continuar</button>
          {voltar('mudas')}
        </form>
      )}

      {etapa === 'pessoa' && (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            setEtapa('conferir');
          }}
        >
          <h2 className="pergunta">{equipe ? 'Quem está pedindo?' : 'Seus dados'}</h2>
          <fieldset className="meses">
            <button type="button" className={`chip ${pessoa.tipo === 'fisica' ? 'ativo' : ''}`} onClick={() => setPessoa({ ...pessoa, tipo: 'fisica' })}>
              Pessoa
            </button>
            <button type="button" className={`chip ${pessoa.tipo === 'juridica' ? 'ativo' : ''}`} onClick={() => setPessoa({ ...pessoa, tipo: 'juridica' })}>
              Instituição
            </button>
          </fieldset>
          <label>
            Nome completo
            <input required value={pessoa.nome} onChange={(e) => setPessoa({ ...pessoa, nome: e.target.value })} />
          </label>
          <label>
            Instituição (escola, associação, prefeitura…)
            <input value={pessoa.instituicao} onChange={(e) => setPessoa({ ...pessoa, instituicao: e.target.value })} />
          </label>
          <label>
            {pessoa.tipo === 'juridica' ? 'CNPJ' : 'CPF'}
            <input inputMode="numeric" value={pessoa.documento} onChange={(e) => setPessoa({ ...pessoa, documento: e.target.value })} />
          </label>
          <label>
            Telefone
            <input type="tel" inputMode="tel" value={pessoa.telefone} onChange={(e) => setPessoa({ ...pessoa, telefone: e.target.value })} />
          </label>
          <p className="dica">CPF, CNPJ e telefone só são vistos pelo gestor.</p>
          <label>
            Ofício de solicitação (PDF ou foto, opcional)
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setOficio(e.target.files?.[0] ?? null)} />
          </label>
          <button className="botao-principal">Continuar</button>
          {voltar('plantio')}
        </form>
      )}

      {etapa === 'conferir' && (
        <div className="assistente">
          <h2 className="pergunta">Confira o pedido</h2>
          <dl className="ficha">
            <dt>Mudas</dt>
            <dd>
              {itens.map((i) => (
                <div key={i.especie_id}>
                  {i.quantidade} · {nomes?.get(i.especie_id) ?? i.especie_id}
                </div>
              ))}
            </dd>
            <dt>Plantio</dt>
            <dd>{[plantio.finalidade, plantio.municipio, plantio.local].filter(Boolean).join(' · ')}</dd>
            <dt>Solicitante</dt>
            <dd>
              {pessoa.nome}
              {pessoa.instituicao ? ` · ${pessoa.instituicao}` : ''}
            </dd>
          </dl>
          {equipe && (
            <button type="button" className={`botao-programa ${programa ? 'ativo' : ''}`} aria-pressed={programa} onClick={() => setPrograma(!programa)} data-testid="plantando-agua">
              <IconeAgua tamanho={32} />
              <span>
                <strong>Plantando Água</strong>
                <small>{programa ? 'As mudas vão para o programa' : 'Toque se as mudas vão para o programa'}</small>
              </span>
            </button>
          )}
          <button className="botao-principal" disabled={salvando} onClick={() => void salvar()}>
            <Icone nome="certo" /> Enviar pedido
          </button>
          {voltar('pessoa')}
        </div>
      )}
    </Tela>
  );
}
