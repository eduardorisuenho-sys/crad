/**
 * Assistente de identificação: uma pergunta por tela, com figuras.
 * No fim, compara candidatas lado a lado e o coletor marca o grau de certeza.
 * Tudo roda no aparelho, sem internet.
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { alertasDaEscolha, NAO_SEI, pontuar, proximaPergunta, type ContextoCampo, type Registro, type Respostas } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { useApp } from '../../contexto';
import { carregarAssistente } from './dados';
import { FiguraOpcao } from './FiguraOpcao';

export type GrauCerteza = 'certo' | 'provavel' | 'a_identificar';

export interface ResultadoIdentificacao {
  especie_id: string | null;
  grau_certeza: GrauCerteza;
  respostas: Respostas & { _vendo?: string };
  alertas: string[];
}

type Etapa = 'vendo' | 'pergunta' | 'candidatas' | 'comparar' | 'certeza';
const LIMITE_LISTA = 4;
const CARACTERES = ['folha', 'disposicao', 'latex', 'espinhos', 'casca', 'flor', 'fruto'] as const;
const ROTULO_CARACTER: Record<string, string> = { folha: 'Folha', disposicao: 'Disposição', latex: 'Látex', espinhos: 'Espinhos', casca: 'Casca', flor: 'Flor', fruto: 'Fruto' };

export function Assistente({ contexto, onEscolher }: { contexto: Omit<ContextoCampo, 'vendo'>; onEscolher: (r: ResultadoIdentificacao) => void }) {
  const { db } = useApp();
  const dados = useLiveQuery(() => carregarAssistente(db), [db]);
  const especies = useLiveQuery(async () => new Map((await db.colecao('especie').toArray()).map((e) => [e.id, e])), [db]);
  const populares = useLiveQuery(async () => {
    const m = new Map<string, string>();
    for (const n of await db.colecao('nome_popular').toArray()) if (!n.excluido && !m.has(String(n.especie_id))) m.set(String(n.especie_id), String(n.nome));
    return m;
  }, [db]);

  const [etapa, setEtapa] = useState<Etapa>('vendo');
  const [vendo, setVendo] = useState<('flor' | 'fruto')[]>([]);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [historico, setHistorico] = useState<string[]>([]);
  const [comparando, setComparando] = useState<string[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const ctx: ContextoCampo = { ...contexto, vendo };
  const candidatas = useMemo(() => (dados ? pontuar(dados.especies, dados.perguntas, respostas, ctx) : []), [dados, respostas, vendo]); // eslint-disable-line react-hooks/exhaustive-deps
  const pergunta = useMemo(() => (dados ? proximaPergunta(candidatas, dados.especies, dados.perguntas, respostas) : null), [dados, candidatas, respostas]);

  if (!dados || !especies || !populares) return <p className="vazio">Carregando…</p>;
  if (!dados.perguntas.length) return <p className="vazio">O assistente ainda não tem perguntas. Peça ao gestor para cadastrar (Espécies → Assistente).</p>;

  const nome = (id: string) => populares.get(id) ?? String(especies.get(id)?.nome_cientifico ?? '');
  const cientifico = (id: string) => String(especies.get(id)?.nome_cientifico ?? '');

  function responder(opcao: string) {
    setRespostas({ ...respostas, [pergunta!.id]: opcao });
    setHistorico([...historico, pergunta!.id]);
  }
  function desfazer() {
    const ultima = historico[historico.length - 1];
    if (!ultima) return setEtapa('vendo');
    const r = { ...respostas };
    delete r[ultima];
    setRespostas(r);
    setHistorico(historico.slice(0, -1));
  }
  function escolher(id: string | null) {
    setEscolhida(id);
    setEtapa('certeza');
  }
  function finalizar(grau: GrauCerteza) {
    const e = escolhida ? dados!.especies.find((x) => x.id === escolhida) : undefined;
    onEscolher({
      especie_id: escolhida,
      grau_certeza: escolhida ? grau : 'a_identificar',
      respostas: { ...respostas, _vendo: vendo.join(',') },
      alertas: e ? alertasDaEscolha(e, ctx) : [],
    });
  }

  // 1. O que a árvore tem agora
  if (etapa === 'vendo') {
    const alternar = (p: 'flor' | 'fruto') => setVendo(vendo.includes(p) ? vendo.filter((x) => x !== p) : [...vendo, p]);
    return (
      <div className="assistente">
        <h2 className="pergunta">O que a árvore tem agora?</h2>
        <div className="grade-opcoes">
          <button className={`opcao ${vendo.includes('flor') ? 'ativa' : ''}`} onClick={() => alternar('flor')}>
            <FiguraOpcao nome="flor_amarela" />
            <span>Flores</span>
          </button>
          <button className={`opcao ${vendo.includes('fruto') ? 'ativa' : ''}`} onClick={() => alternar('fruto')}>
            <FiguraOpcao nome="fruto_carnoso" />
            <span>Frutos</span>
          </button>
        </div>
        <button className="botao-principal" onClick={() => setEtapa('pergunta')}>
          {vendo.length ? 'Continuar' : 'Só folhas · Continuar'}
        </button>
      </div>
    );
  }

  // 2. Perguntas, uma por vez
  if (etapa === 'pergunta' && pergunta && candidatas.length > 1) {
    return (
      <div className="assistente">
        <p className="contador" data-testid="possiveis">
          {candidatas.length} espécies possíveis ·{' '}
          <button className="link" onClick={() => setEtapa('candidatas')}>
            ver
          </button>
        </p>
        <h2 className="pergunta">{pergunta.texto}</h2>
        <div className="grade-opcoes">
          {pergunta.opcoes.map((o) => (
            <button key={o.id} className="opcao" onClick={() => responder(o.id)}>
              <FiguraOpcao nome={o.figura_padrao} />
              <span>{o.rotulo}</span>
            </button>
          ))}
          <button className="opcao nao-sei" onClick={() => responder(NAO_SEI)}>
            <FiguraOpcao nome="nao_sei" />
            <span>Não sei</span>
          </button>
        </div>
        <button className="botao-secundario" onClick={desfazer}>
          <Icone nome="voltar" /> Voltar
        </button>
      </div>
    );
  }

  // 3. Candidatas
  if (etapa === 'pergunta' || etapa === 'candidatas') {
    const lista = candidatas.slice(0, Math.max(LIMITE_LISTA, comparando.length));
    return (
      <div className="assistente">
        <h2 className="pergunta">{lista.length ? 'Qual destas é a árvore?' : 'Nenhuma espécie combina'}</h2>
        <ul className="lista">
          {lista.map((c) => (
            <li key={c.especie_id} className="item-lista candidata">
              <input
                type="checkbox"
                aria-label={`Comparar ${nome(c.especie_id)}`}
                checked={comparando.includes(c.especie_id)}
                onChange={() => setComparando(comparando.includes(c.especie_id) ? comparando.filter((x) => x !== c.especie_id) : [...comparando, c.especie_id].slice(-3))}
              />
              <div>
                <strong>{nome(c.especie_id)}</strong>
                <small>
                  <i>{cientifico(c.especie_id)}</i>
                </small>
                {c.alertas.map((a) => (
                  <small key={a} className="alerta-texto">
                    {a}
                  </small>
                ))}
              </div>
              <button className="botao-secundario" onClick={() => escolher(c.especie_id)}>
                É esta
              </button>
            </li>
          ))}
        </ul>
        {comparando.length >= 2 && (
          <button className="botao-principal" onClick={() => setEtapa('comparar')}>
            Comparar lado a lado ({comparando.length})
          </button>
        )}
        <button className="botao-secundario" onClick={() => escolher(null)}>
          Não sei qual é (a identificar)
        </button>
        {pergunta && (
          <button className="botao-secundario" onClick={() => setEtapa('pergunta')}>
            Responder mais perguntas
          </button>
        )}
        <button className="botao-secundario" onClick={desfazer}>
          <Icone nome="voltar" /> Voltar
        </button>
      </div>
    );
  }

  // 4. Comparação lado a lado
  if (etapa === 'comparar') {
    const cols = comparando.map((id) => especies.get(id)).filter((e): e is Registro => !!e);
    return (
      <div className="assistente">
        <h2 className="pergunta">Compare com a árvore à sua frente</h2>
        <div className="comparar" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((e) => (
            <div key={e.id} className="coluna">
              <strong>{nome(e.id)}</strong>
              <small>
                <i>{String(e.nome_cientifico)}</i>
              </small>
              {CARACTERES.filter((c) => e[c]).map((c) => (
                <p key={c}>
                  <b>{ROTULO_CARACTER[c]}:</b> {String(e[c])}
                </p>
              ))}
              {dados.perguntas.map((p) => {
                const marcadas = p.opcoes.filter((o) => dados.especies.find((x) => x.id === e.id)?.opcoes.has(o.id));
                return marcadas.length ? (
                  <div key={p.id} className="mini-figuras" title={p.texto}>
                    {marcadas.map((o) => (
                      <FiguraOpcao key={o.id} nome={o.figura_padrao} tamanho={36} />
                    ))}
                  </div>
                ) : null;
              })}
              <button className="botao-principal" onClick={() => escolher(e.id)}>
                É esta
              </button>
            </div>
          ))}
        </div>
        <button className="botao-secundario" onClick={() => setEtapa('candidatas')}>
          <Icone nome="voltar" /> Voltar
        </button>
      </div>
    );
  }

  // 5. Grau de certeza
  const e = escolhida ? dados.especies.find((x) => x.id === escolhida) : undefined;
  const alertas = e ? alertasDaEscolha(e, ctx) : [];
  return (
    <div className="assistente">
      <h2 className="pergunta">{escolhida ? nome(escolhida) : 'Espécie a identificar'}</h2>
      {escolhida && (
        <p>
          <i>{cientifico(escolhida)}</i>
        </p>
      )}
      {alertas.map((a) => (
        <p key={a} className="mensagem alerta">
          <Icone nome="aviso" tamanho={20} /> {a}
        </p>
      ))}
      {escolhida ? (
        <>
          <h3>Você tem certeza?</h3>
          <div className="lista-grande">
            <button className="botao-grande" onClick={() => finalizar('certo')}>
              <Icone nome="certo" tamanho={40} />
              <span>Tenho certeza</span>
            </button>
            <button className="botao-grande" onClick={() => finalizar('provavel')}>
              <Icone nome="aviso" tamanho={40} />
              <span>Acho que é (provável)</span>
            </button>
            <button className="botao-grande" onClick={() => finalizar('a_identificar')}>
              <FiguraOpcao nome="nao_sei" tamanho={40} />
              <span>Não sei (a identificar)</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Tire boas fotos da folha (frente e verso), da casca, da flor e do fruto. O gestor ou um botânico vai confirmar depois.</p>
          <button className="botao-principal" onClick={() => finalizar('a_identificar')}>
            Continuar
          </button>
        </>
      )}
      <button className="botao-secundario" onClick={() => setEtapa('candidatas')}>
        <Icone nome="voltar" /> Voltar
      </button>
    </div>
  );
}
