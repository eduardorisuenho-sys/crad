/** Catálogo público: espécies com mudas prontas para doação, sem login. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizarBusca, type ItemCatalogo, type ResumoCatalogo } from '@crads/dominio';
import { BotaoPdf } from '../../componentes/BotaoPdf';
import { Icone } from '../../componentes/Icone';
import { dataCarimbo } from '../../componentes/Miniatura';
import { gerarFichasPdf } from './fichasPdf';
import { useApp } from '../../contexto';
import { lerCatalogo, servidorPublico, urlFoto } from './api';
import { Pagina } from './Pagina';
import { DiagnosticoCatalogo } from './DiagnosticoCatalogo';

export function Catalogo() {
  const { sessao, perfis } = useApp();
  const equipe = perfis.includes('viveirista') || perfis.includes('gestor');
  const pedido = servidorPublico(sessao?.servidor);
  // servidor que respondeu (o app acha o certo sozinho se o endereço falhar)
  const [servidor, setServidor] = useState(pedido);
  const navegar = useNavigate();
  const [itens, setItens] = useState<ItemCatalogo[] | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [regras, setRegras] = useState<number | undefined>(undefined);
  const [resumo, setResumo] = useState<ResumoCatalogo | undefined>(undefined);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [viveiro, setViveiro] = useState('');
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    lerCatalogo(pedido)
      .then((r) => {
        setItens(r.dados.itens);
        setServidor(r.servidor);
        setRegras(r.dados.regras);
        setResumo(r.dados.resumo);
        setGuardado(r.guardado ? r.em : null);
      })
      .catch((e) => setErro((e as Error).message));
  }, [pedido]);

  const viveiros = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itens ?? []) for (const v of i.por_viveiro) m.set(v.viveiro_id, v.viveiro);
    return [...m.entries()];
  }, [itens]);
  // situação de cada lote no servidor (a versão nova manda todos; a antiga, só os de fora)
  const noServidor = useMemo(
    () => new Map<string, string | { situacao: string; especie_id?: string }>(resumo?.lotes_servidor ? resumo.lotes_servidor.map((l) => [l.codigo, { situacao: l.situacao, especie_id: l.especie_id }]) : (resumo?.fora ?? []).map((f) => [f.codigo, f.situacao as string])),
    [resumo],
  );
  const noCatalogo = useMemo(() => new Set((itens ?? []).map((i) => i.especie_id)), [itens]);
  const lista = (itens ?? []).filter((i) => {
    if (viveiro && !i.por_viveiro.some((v) => v.viveiro_id === viveiro)) return false;
    if (!busca) return true;
    return normalizarBusca(`${i.nomes_populares.join(' ')} ${i.nome_cientifico}`).includes(normalizarBusca(busca));
  });

  function rastrear(e: FormEvent) {
    e.preventDefault();
    if (codigo.trim()) navegar(`/rastreio/${encodeURIComponent(codigo.trim().toUpperCase())}`);
  }

  return (
    <Pagina titulo="Catálogo de mudas">
      <p className="dica">Mudas nativas prontas para doação. A quantidade já desconta as mudas reservadas para pedidos aprovados.</p>
      {guardado && (
        <p className="mensagem alerta">
          <Icone nome="semSinal" tamanho={20} /> Sem internet: mostrando o catálogo de {new Date(guardado).toLocaleString('pt-BR')}.
        </p>
      )}
      {erro && <p className="erro">{erro}</p>}
      <input className="campo-busca" type="search" placeholder="Buscar pelo nome da árvore" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no catálogo" />
      {viveiros.length > 1 && (
        <div className="filtros" role="group" aria-label="Viveiro">
          <button className={`chip ${!viveiro ? 'ativo' : ''}`} onClick={() => setViveiro('')}>
            Todos os viveiros
          </button>
          {viveiros.map(([id, nome]) => (
            <button key={id} className={`chip ${viveiro === id ? 'ativo' : ''}`} onClick={() => setViveiro(id)}>
              {nome}
            </button>
          ))}
        </div>
      )}
      {itens === null && !erro && <p className="vazio">Carregando…</p>}
      {equipe && itens && !guardado && <DiagnosticoCatalogo noCatalogo={noCatalogo} regras={regras} noServidor={noServidor} />}
      <ul className="grade-catalogo">
        {lista.map((i) => {
          const qtd = viveiro ? i.por_viveiro.find((v) => v.viveiro_id === viveiro)?.disponivel ?? 0 : i.total;
          return (
            <li key={i.especie_id}>
              <Link to={`/catalogo/${i.especie_id}`} className="cartao-especie">
                {i.foto ? (
                  <span className="foto-datada foto-cartao">
                    <img src={urlFoto(servidor, i.foto)} alt="" loading="lazy" />
                    {dataCarimbo(i.foto.data) && (
                      <span className="carimbo-data" data-testid="data-foto">
                        {dataCarimbo(i.foto.data)}
                      </span>
                    )}
                  </span>
                ) : <span className="sem-foto"><Icone nome="muda" tamanho={48} /></span>}
                <strong>{i.nomes_populares[0] ?? i.nome_cientifico}</strong>
                <small>
                  <i>{i.nome_cientifico}</i>
                </small>
                <span className="selo ok">{qtd} mudas</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {itens && !lista.length && <p className="vazio">Nenhuma muda pronta {busca ? 'com esse nome' : 'no momento'}.</p>}
      {itens && !itens.length && !guardado && (
        // catálogo vazio: diz o que o servidor tem (só contagens) e de onde o app leu
        <p className="dica" data-testid="resumo-catalogo">
          {resumo
            ? resumo.lotes
              ? `No servidor há ${resumo.lotes} lote(s) de mudas: ${[
                  [resumo.em_formacao, 'em formação (ainda não marcados como prontos)'],
                  [resumo.reservadas, 'com todas as mudas reservadas'],
                  [resumo.sem_entrada, 'sem a quantidade de mudas (não chegou ao servidor)'],
                  [resumo.esgotado, 'sem mudas (todas já saíram)'],
                  [resumo.sem_especie, 'de espécie apagada'],
                ]
                  .filter(([n]) => Number(n) > 0)
                  .map(([n, t]) => `${n} ${t}`)
                  .join(', ')}.`
              : 'O servidor ainda não tem nenhum lote de mudas registrado.'
            : 'O servidor ainda está na versão antiga: peça para atualizar.'}{' '}
          Servidor: {servidor.replace(/^https?:\/\//, '')}
        </p>
      )}
      {lista.length > 0 && (
        <BotaoPdf
          rotulo={`Imprimir o catálogo com fotos (PDF, ${lista.length} ${lista.length === 1 ? 'espécie' : 'espécies'})`}
          nome="catalogo-de-mudas.pdf"
          gerar={(progresso) =>
            gerarFichasPdf(
              servidor,
              'Catálogo de mudas nativas',
              `Mudas prontas para doação${viveiro ? ` · ${viveiros.find(([v]) => v === viveiro)?.[1] ?? ''}` : ''} · ${new Date().toLocaleDateString('pt-BR')}`,
              lista.map((i) => {
                const qtd = viveiro ? i.por_viveiro.find((v) => v.viveiro_id === viveiro)?.disponivel ?? 0 : i.total;
                return { especie_id: i.especie_id, destaque: `${qtd} mudas prontas`, reserva: i };
              }),
              progresso,
            )
          }
        />
      )}
      <form className="cartao formulario" onSubmit={rastrear}>
        <h2>Rastrear um lote</h2>
        <label>
          Código do lote de mudas
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="LM-2026-045-A" />
        </label>
        <button className="botao-secundario">Ver de onde vieram as sementes</button>
      </form>
      {/* quem só pede mudas não vê os resultados das doações; a equipe vê */}
      {sessao && perfis.some((p) => p !== 'solicitante') && (
        <Link to="/transparencia" className="botao-grande">
          <Icone nome="relatorio" /> Resultados das doações (transparência)
        </Link>
      )}
    </Pagina>
  );
}
