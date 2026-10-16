/**
 * Mudas que já estavam no viveiro antes do app: uma espécie por vez, várias
 * numa lista, ou por planilha. Funciona sem internet.
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { bloqueiosEstoqueInicial, escreverXlsx, lerCsv, lerXlsx, modeloPlanilhaEstoque, normalizarBusca, planejarEstoqueInicial, type ItemEstoqueInicial } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { nomesEspecies } from '../coleta/dados';
import { EscolherEspecie } from '../especies/EscolherEspecie';
import { baixar } from '../relatorios/dados';
import { cadastrarEstoqueInicial } from './estoque';
import { BotaoFoto } from '../../componentes/BotaoFoto';
import { MiniaturaBlob } from '../../componentes/Miniatura';
import { gravarFoto, prepararFoto, type FotoPendente } from '../matrizes/fotos';

type Modo = 'escolher' | 'uma' | 'lista' | 'planilha';
// As mudas que já estavam no viveiro entram prontas para doação.
const fase = 'pronta';

export function EstoqueInicial() {
  const { db, repo, pode, viveiroId } = useApp();
  const [foto, setFoto] = useState<FotoPendente | null>(null);
  const navegar = useNavigate();
  const [modo, setModo] = useState<Modo>('escolher');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);

  // ---- uma espécie por vez
  const [especie, setEspecie] = useState('');
  const [qtd, setQtd] = useState('');
  const [canteiro, setCanteiro] = useState('');

  // ---- lista
  const [busca, setBusca] = useState('');
  const [qtds, setQtds] = useState<Record<string, string>>({});

  // ---- planilha
  const [plano, setPlano] = useState<{ itens: ItemEstoqueInicial[]; erros: string[] } | null>(null);

  const especies = useMemo(() => [...(nomes ?? new Map<string, string>())].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), [nomes]);

  if (!pode('estoque_inicial')) return <Tela titulo="Mudas que já estavam aqui"><p className="vazio">Você não tem permissão para esta parte.</p></Tela>;
  if (!viveiroId)
    return (
      <Tela titulo="Mudas que já estavam aqui">
        <p className="mensagem alerta">Escolha primeiro em qual viveiro estão as mudas.</p>
        <Link to="/viveiro-atual" className="botao-principal">
          Escolher viveiro
        </Link>
      </Tela>
    );

  async function gravar(itens: ItemEstoqueInicial[], depois: string) {
    setErro('');
    const b = bloqueiosEstoqueInicial(itens);
    if (b.length) return setErro(b.join(' '));
    const ids = await cadastrarEstoqueInicial(repo, itens);
    const total = itens.reduce((s, i) => s + i.quantidade, 0);
    setMsg(`${total} mudas de ${ids.length} espécie(s) cadastradas. ${depois}`);
    return ids;
  }

  async function lerArquivo(arquivo: File) {
    setErro('');
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const abas = /\.csv$/i.test(arquivo.name) ? lerCsv(new TextDecoder().decode(bytes)) : lerXlsx(bytes);
      const [esp, pop] = await Promise.all([db.colecao('especie').toArray(), db.colecao('nome_popular').toArray()]);
      const aba = abas.find((a) => planejarEstoqueInicial(a.linhas, esp, pop).itens.length) ?? abas[0];
      if (!aba) return setErro('Planilha vazia.');
      setPlano(planejarEstoqueInicial(aba.linhas, esp, pop));
    } catch {
      setErro('Não foi possível ler o arquivo. Use .xlsx ou .csv.');
    }
  }

  const titulo = 'Registrar mudas';
  return (
    <Tela titulo={titulo}>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {msg && <p className="mensagem" data-testid="estoque-ok">{msg}</p>}

      {modo === 'escolher' && (
        <div className="lista-grande">
          <p className="dica">Cadastre as mudas que já existiam no viveiro antes do app. Elas entram como prontas para doação. A origem das sementes fica como “não registrada”.</p>
          <button className="botao-grande" onClick={() => setModo('uma')}>
            <Icone nome="muda" tamanho={40} />
            <span>
              Uma espécie por vez<small className="dica-botao">Passo a passo</small>
            </span>
          </button>
          <button className="botao-grande" onClick={() => setModo('lista')}>
            <Icone nome="catalogo" tamanho={40} />
            <span>
              Várias de uma vez<small className="dica-botao">Lista com todas as espécies</small>
            </span>
          </button>
          <button className="botao-grande" onClick={() => setModo('planilha')}>
            <Icone nome="relatorio" tamanho={40} />
            <span>
              Importar planilha<small className="dica-botao">Excel ou CSV: Espécie e Quantidade</small>
            </span>
          </button>
        </div>
      )}

      {modo === 'uma' && !especie && (
        <>
          <p className="pergunta">Qual é a espécie?</p>
          <EscolherEspecie aoEscolher={setEspecie} />
        </>
      )}
      {modo === 'uma' && especie && (
        <form
          className="formulario"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await gravar([{ especie_id: especie, quantidade: Number(qtd), fase, canteiro }], '');
            if (ok && foto) await gravarFoto(db, repo, 'lote_mudas', ok[0], viveiroId ?? undefined, foto);
            if (ok) {
              setFoto(null);
              setEspecie('');
              setQtd('');
              setCanteiro('');
            }
          }}
        >
          <p className="passo">{nomes?.get(especie)}</p>
          <label>
            Quantas mudas?
            <input className="campo-grande" inputMode="numeric" pattern="[0-9]*" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ''))} required autoFocus />
          </label>
          <div className="linha-foto">
            {foto && <MiniaturaBlob blob={foto.miniatura} alt="Foto das mudas" tamanho={72} />}
            <BotaoFoto aoEscolher={async (f) => setFoto(await prepararFoto(f, 'muda', null))} className="botao-secundario">
              <Icone nome="camera" /> {foto ? 'Trocar a foto' : 'Tirar foto das mudas (opcional)'}
            </BotaoFoto>
          </div>
          <label>
            Onde estão? (opcional)
            <input value={canteiro} onChange={(e) => setCanteiro(e.target.value)} placeholder="Ex.: canteiro 3" />
          </label>
          <button className="botao-principal">
            <Icone nome="certo" /> Salvar
          </button>
          <button type="button" className="link" onClick={() => setEspecie('')}>
            Trocar a espécie
          </button>
        </form>
      )}

      {modo === 'lista' && (
        <>
          <p className="dica">Escreva a quantidade só nas espécies que existem no viveiro.</p>
          <input className="campo-busca" type="search" placeholder="Procurar espécie" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar espécie" />
          <ul className="lista" data-testid="lista-estoque">
            {especies
              .filter(([, n]) => !busca || normalizarBusca(n).includes(normalizarBusca(busca)))
              .map(([id, n]) => (
                <li key={id} className="item-lista">
                  <div>
                    <strong>{n}</strong>
                  </div>
                  <input
                    className="campo-contagem"
                    inputMode="numeric"
                    aria-label={`Quantidade de ${n}`}
                    value={qtds[id] ?? ''}
                    onChange={(e) => setQtds({ ...qtds, [id]: e.target.value.replace(/\D/g, '') })}
                  />
                </li>
              ))}
          </ul>
          <button
            className="botao-principal"
            onClick={async () => {
              const ok = await gravar(
                Object.entries(qtds)
                  .filter(([, q]) => Number(q) > 0)
                  .map(([especie_id, q]) => ({ especie_id, quantidade: Number(q), fase })),
                'Confira em Viveiro.',
              );
              if (ok) setQtds({});
            }}
          >
            <Icone nome="certo" /> Salvar todas ({Object.values(qtds).filter((q) => Number(q) > 0).length})
          </button>
        </>
      )}

      {modo === 'planilha' && !plano && (
        <>
          <section className="cartao">
            <h2>1. Baixe o modelo</h2>
            <p>Colunas: Espécie (nome popular ou científico), Quantidade, Canteiro e Observação.</p>
            <button
              className="botao-secundario"
              onClick={() => baixar(new Blob([escreverXlsx([{ nome: 'Estoque inicial', linhas: modeloPlanilhaEstoque() }]) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'modelo-estoque-inicial.xlsx')}
            >
              Baixar modelo
            </button>
          </section>
          <section className="cartao">
            <h2>2. Escolha a planilha preenchida</h2>
            <label className="botao-principal botao-arquivo">
              <Icone nome="mais" /> Escolher arquivo
              <input type="file" accept=".xlsx,.xlsm,.csv" hidden onChange={(e) => e.target.files?.[0] && void lerArquivo(e.target.files[0])} />
            </label>
          </section>
        </>
      )}
      {modo === 'planilha' && plano && (
        <section className="cartao" data-testid="previa-estoque">
          <h2>Conferir</h2>
          <p>
            {plano.itens.length} linha(s) prontas · {plano.itens.reduce((s, i) => s + i.quantidade, 0)} mudas
          </p>
          <ul className="historico">
            {plano.itens.map((i) => (
              <li key={i.linha}>
                {nomes?.get(i.especie_id)}: {i.quantidade}
                {i.canteiro ? ` · ${i.canteiro}` : ''}
              </li>
            ))}
          </ul>
          {plano.erros.length > 0 && (
            <>
              <p className="alerta-texto">{plano.erros.length} linha(s) com problema (não serão gravadas):</p>
              <ul className="historico">
                {plano.erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
          <div className="acoes">
            <button className="botao-secundario" onClick={() => setPlano(null)}>
              Escolher outro arquivo
            </button>
            <button
              className="botao-principal"
              disabled={!plano.itens.length}
              onClick={async () => {
                if (await gravar(plano.itens, 'Confira em Viveiro.')) setPlano(null);
              }}
            >
              Gravar
            </button>
          </div>
        </section>
      )}

      {modo !== 'escolher' && (
        <div className="acoes">
          <button
            className="botao-secundario"
            onClick={() => {
              setModo('escolher');
              setMsg('');
              setErro('');
            }}
          >
            <Icone nome="voltar" /> Outra forma
          </button>
          <button className="botao-secundario" onClick={() => navegar('/viveiro')}>
            Ver o viveiro
          </button>
        </div>
      )}
    </Tela>
  );
}
