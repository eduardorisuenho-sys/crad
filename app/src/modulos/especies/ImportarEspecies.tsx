/**
 * Importação de espécies pelo gestor: planilha (.xlsx, .xlsm, .csv) ou o
 * pacote da Flora e Funga (.zip). Mostra uma prévia antes de gravar.
 */
import { useState } from 'react';
import {
  especiesDaFlora,
  FORMAS_VIDA_PADRAO,
  lerCsv,
  lerDwca,
  lerLinhas,
  lerXlsx,
  planejarFlora,
  planejarImportacao,
  acharCabecalho,
  type Aba,
  type PlanoFlora,
  type PlanoImportacao,
} from '@crads/dominio';
import { useNavigate } from 'react-router-dom';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { aplicarFlora, aplicarPlanilha, carregarExistentes } from './dados';

type Estado =
  | { etapa: 'escolher' }
  | { etapa: 'aba'; abas: Aba[] }
  | { etapa: 'previa-planilha'; plano: PlanoImportacao; aba: string }
  | { etapa: 'previa-flora'; plano: PlanoFlora; uf: string }
  | { etapa: 'gravando'; feito: number; total: number }
  | { etapa: 'pronto'; mensagem: string };

const FORMAS = [
  { valor: 'arvore', rotulo: 'Árvore' },
  { valor: 'arbusto', rotulo: 'Arbusto' },
  { valor: 'palmeira', rotulo: 'Palmeira' },
  { valor: 'liana_volivel_trepadeira', rotulo: 'Trepadeira' },
  { valor: 'subarbusto', rotulo: 'Subarbusto' },
];

export function ImportarEspecies() {
  const { db, repo, perfis } = useApp();
  const navegar = useNavigate();
  const [estado, setEstado] = useState<Estado>({ etapa: 'escolher' });
  const [erro, setErro] = useState('');
  const [uf, setUf] = useState('TO');
  const [formas, setFormas] = useState<string[]>(FORMAS_VIDA_PADRAO);

  if (!perfis.includes('gestor')) return <Tela titulo="Importar espécies"><p className="vazio">Só o gestor importa espécies.</p></Tela>;

  async function preverPlanilha(aba: Aba) {
    const { registros, erro } = lerLinhas(aba.linhas);
    if (erro) return setErro(erro);
    setEstado({ etapa: 'previa-planilha', plano: planejarImportacao(registros, await carregarExistentes(db)), aba: aba.nome });
  }

  async function aoEscolher(arquivo: File) {
    setErro('');
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      if (/\.zip$/i.test(arquivo.name)) {
        const flora = especiesDaFlora(lerDwca(bytes), { uf, formasVida: formas });
        if (!flora.length) return setErro(`Nenhuma espécie de ${uf} com essas formas de vida no pacote.`);
        setEstado({ etapa: 'previa-flora', plano: planejarFlora(flora, await carregarExistentes(db), uf), uf });
        return;
      }
      const abas = /\.csv$/i.test(arquivo.name) ? lerCsv(new TextDecoder().decode(bytes)) : lerXlsx(bytes);
      const validas = abas.filter((a) => acharCabecalho(a.linhas) >= 0);
      if (!validas.length) return setErro('Nenhuma aba tem a coluna "Nome científico".');
      if (validas.length === 1) await preverPlanilha(validas[0]);
      else setEstado({ etapa: 'aba', abas: validas });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function gravar() {
    const progresso = (feito: number, total: number) => setEstado({ etapa: 'gravando', feito, total });
    if (estado.etapa === 'previa-planilha') {
      await aplicarPlanilha(repo, estado.plano, progresso);
      setEstado({ etapa: 'pronto', mensagem: `${estado.plano.resumo.novas} espécies novas e ${estado.plano.resumo.atualizadas} completadas.` });
    } else if (estado.etapa === 'previa-flora') {
      await aplicarFlora(repo, estado.plano, estado.uf, progresso);
      setEstado({ etapa: 'pronto', mensagem: `${estado.plano.novas.length} espécies novas e ${estado.plano.atualizadas.length} ligadas à Flora e Funga.` });
    }
  }

  return (
    <Tela titulo="Importar espécies">
      {erro && <p className="erro" role="alert">{erro}</p>}

      {estado.etapa === 'escolher' && (
        <>
          <section className="cartao">
            <h2>Planilha</h2>
            <p>
              Planilha do Excel (.xlsx ou .xlsm) ou .csv com as colunas <b>Nome popular</b>, <b>Família</b> e <b>Nome científico</b>. Pode usar a planilha de
              controle atual (só a lista de espécies é lida) ou o modelo completo em <code>dados/modelo-especies.xlsx</code>.
            </p>
          </section>
          <section className="cartao">
            <h2>Flora e Funga do Brasil</h2>
            <p>
              Pacote “Darwin Core Archive” (.zip) da lista de espécies, baixado do site do JBRJ (ipt.jbrj.gov.br). Entram só as espécies aceitas que ocorrem na
              UF abaixo.
            </p>
            <div className="formulario">
              <label>
                UF
                <input value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
              </label>
              <fieldset className="meses">
                <legend>Formas de vida</legend>
                {FORMAS.map((f) => (
                  <button
                    type="button"
                    key={f.valor}
                    className={`chip ${formas.includes(f.valor) ? 'ativo' : ''}`}
                    onClick={() => setFormas(formas.includes(f.valor) ? formas.filter((x) => x !== f.valor) : [...formas, f.valor])}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </fieldset>
            </div>
          </section>
          <label className="botao-principal botao-arquivo">
            <Icone nome="mais" /> Escolher arquivo
            <input type="file" accept=".xlsx,.xlsm,.csv,.zip" onChange={(e) => e.target.files?.[0] && void aoEscolher(e.target.files[0])} hidden />
          </label>
        </>
      )}

      {estado.etapa === 'aba' && (
        <div className="lista-grande">
          <p>Qual aba tem a lista de espécies?</p>
          {estado.abas.map((a) => (
            <button key={a.nome} className="botao-grande" onClick={() => void preverPlanilha(a)}>
              <Icone nome="catalogo" tamanho={36} />
              <span>
                {a.nome} <small>({a.linhas.length} linhas)</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {estado.etapa === 'previa-planilha' && (
        <>
          <dl className="ficha" data-testid="previa">
            <dt>Aba</dt>
            <dd>{estado.aba}</dd>
            <dt>Linhas lidas</dt>
            <dd>{estado.plano.resumo.linhas}</dd>
            <dt>Espécies novas</dt>
            <dd>{estado.plano.resumo.novas}</dd>
            <dt>Espécies já cadastradas que serão completadas</dt>
            <dd>{estado.plano.resumo.atualizadas}</dd>
            <dt>Nomes populares novos</dt>
            <dd>{estado.plano.resumo.nomesPopulares}</dd>
            <dt>Marcadas para revisar</dt>
            <dd>{estado.plano.resumo.paraRevisar}</dd>
          </dl>
          <Revisoes itens={estado.plano.novas.filter((n) => n.dados.revisar).map((n) => `${n.dados.nome_cientifico}: ${n.dados.nota_revisao}`)} />
          <Lista titulo="Linhas ignoradas" itens={estado.plano.erros.map((e) => `linha ${e.linha}: ${e.mensagem}`)} />
          <Lista titulo="Avisos" itens={estado.plano.avisos.map((a) => a.mensagem)} />
          <Confirmar onConfirmar={gravar} onCancelar={() => setEstado({ etapa: 'escolher' })} />
        </>
      )}

      {estado.etapa === 'previa-flora' && (
        <>
          <dl className="ficha">
            <dt>Espécies novas de {estado.uf}</dt>
            <dd>{estado.plano.novas.length}</dd>
            <dt>Espécies já cadastradas ligadas à Flora e Funga</dt>
            <dd>{estado.plano.atualizadas.length}</dd>
          </dl>
          <Lista titulo="Avisos" itens={estado.plano.avisos} />
          <Confirmar onConfirmar={gravar} onCancelar={() => setEstado({ etapa: 'escolher' })} />
        </>
      )}

      {estado.etapa === 'gravando' && (
        <div className="vazio">
          <progress max={estado.total} value={estado.feito} />
          <p>
            Gravando {estado.feito} de {estado.total}…
          </p>
        </div>
      )}

      {estado.etapa === 'pronto' && (
        <div className="vazio">
          <Icone nome="certo" tamanho={72} />
          <p>{estado.mensagem}</p>
          <p>Os dados vão para o servidor na próxima sincronização.</p>
          <button className="botao-principal" onClick={() => navegar('/especies')}>
            Ver espécies
          </button>
        </div>
      )}
    </Tela>
  );
}

function Revisoes({ itens }: { itens: string[] }) {
  return <Lista titulo="Para revisar" itens={itens} aberta />;
}

function Lista({ titulo, itens, aberta = false }: { titulo: string; itens: string[]; aberta?: boolean }) {
  if (!itens.length) return null;
  return (
    <details className="cartao" open={aberta}>
      <summary>
        {titulo} ({itens.length})
      </summary>
      <ul>
        {itens.slice(0, 200).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  );
}

function Confirmar({ onConfirmar, onCancelar }: { onConfirmar: () => Promise<void>; onCancelar: () => void }) {
  return (
    <div className="acoes">
      <button className="botao-secundario" onClick={onCancelar}>
        Cancelar
      </button>
      <button className="botao-principal" onClick={() => void onConfirmar()}>
        <Icone nome="certo" /> Importar
      </button>
    </div>
  );
}
