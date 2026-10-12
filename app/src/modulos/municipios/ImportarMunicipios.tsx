/**
 * Importação dos municípios (nomes e contornos do IBGE) pelo gestor. Com os
 * contornos no aparelho, o município é preenchido pelo GPS, mesmo sem internet.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { lerMunicipiosIbge, planejarMunicipios, UF_CODIGO, urlMalhaIbge, urlNomesIbge, type PlanoMunicipios } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { listaMunicipios } from './dados';

type Estado = { etapa: 'escolher' } | { etapa: 'previa'; plano: PlanoMunicipios; avisos: string[] } | { etapa: 'gravando'; feito: number; total: number } | { etapa: 'pronto'; mensagem: string };

export function ImportarMunicipios() {
  const { db, repo, pode, online } = useApp();
  const [estado, setEstado] = useState<Estado>({ etapa: 'escolher' });
  const [uf, setUf] = useState('TO');
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(false);
  const total = useLiveQuery(async () => (await listaMunicipios(db)).length, [db]);

  if (!pode('viveiros')) return <Tela titulo="Municípios"><p className="vazio">Só o gestor importa municípios.</p></Tela>;

  async function prever(malha: unknown, nomes?: unknown) {
    const { municipios, erros } = lerMunicipiosIbge(malha, nomes);
    if (!municipios.length) return setErro(erros[0] ?? 'Nenhum município no arquivo.');
    setEstado({ etapa: 'previa', plano: planejarMunicipios(municipios, await listaMunicipios(db)), avisos: erros });
  }

  async function baixarDoIbge() {
    setErro('');
    setBaixando(true);
    try {
      const codigo = UF_CODIGO[uf];
      if (!codigo) throw new Error('UF inválida.');
      const [malha, nomes] = await Promise.all(
        [urlMalhaIbge(codigo), urlNomesIbge(codigo)].map(async (u) => {
          const r = await fetch(u);
          if (!r.ok) throw new Error(`O IBGE respondeu ${r.status}.`);
          return r.json();
        }),
      );
      await prever(malha, nomes);
    } catch (e) {
      setErro(`Não foi possível baixar do IBGE (${(e as Error).message}). Baixe os arquivos e escolha abaixo.`);
    } finally {
      setBaixando(false);
    }
  }

  async function aoEscolher(arquivos: FileList) {
    setErro('');
    try {
      const jsons = await Promise.all([...arquivos].map(async (a) => JSON.parse(await a.text()) as unknown));
      const malha = jsons.find((j) => (j as { type?: string })?.type === 'FeatureCollection');
      const nomes = jsons.find((j) => Array.isArray(j));
      if (!malha) return setErro('Escolha o arquivo da malha (GeoJSON) dos municípios.');
      await prever(malha, nomes);
    } catch {
      setErro('Arquivo ilegível. Use os arquivos .json/.geojson do IBGE.');
    }
  }

  async function gravar(plano: PlanoMunicipios) {
    const itens = [...plano.novos.map((m) => ({ id: undefined, dados: m })), ...plano.atualizar];
    for (const [i, { id, dados }] of itens.entries()) {
      setEstado({ etapa: 'gravando', feito: i, total: itens.length });
      await repo.salvar('municipio', { ...dados }, id);
    }
    setEstado({ etapa: 'pronto', mensagem: `${plano.novos.length} municípios novos e ${plano.atualizar.length} atualizados.` });
  }

  return (
    <Tela titulo="Municípios">
      <p className="dica">
        Com os municípios do IBGE no aparelho, o município da matriz e do plantio é preenchido pelo GPS, mesmo sem internet. Hoje há <b data-testid="total-municipios">{total ?? 0}</b> municípios.
      </p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {estado.etapa === 'escolher' && (
        <>
          <section className="cartao formulario">
            <label>
              UF
              <input value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </label>
            <button className="botao-principal" onClick={() => void baixarDoIbge()} disabled={!online || baixando}>
              {baixando ? 'Baixando…' : 'Baixar do IBGE'}
            </button>
          </section>
          <section className="cartao">
            <h2>Ou escolha os arquivos</h2>
            <p>
              Baixe no navegador os dois arquivos abaixo e escolha os dois de uma vez. O primeiro tem os contornos; o segundo, os nomes.
            </p>
            <ul className="lista-simples">
              <li>
                <a href={urlMalhaIbge(UF_CODIGO[uf] ?? '17')} target="_blank" rel="noreferrer">Malha dos municípios ({uf})</a>
              </li>
              <li>
                <a href={urlNomesIbge(UF_CODIGO[uf] ?? '17')} target="_blank" rel="noreferrer">Nomes dos municípios ({uf})</a>
              </li>
            </ul>
          </section>
          <label className="botao-secundario botao-arquivo">
            <Icone nome="mais" /> Escolher arquivos
            <input type="file" accept=".json,.geojson,application/json" multiple onChange={(e) => e.target.files?.length && void aoEscolher(e.target.files)} hidden />
          </label>
        </>
      )}
      {estado.etapa === 'previa' && (
        <section className="cartao">
          <h2>Conferir</h2>
          <dl className="ficha" data-testid="previa-municipios">
            <dt>Novos</dt>
            <dd>{estado.plano.novos.length}</dd>
            <dt>Atualizados</dt>
            <dd>{estado.plano.atualizar.length}</dd>
            <dt>Sem mudança</dt>
            <dd>{estado.plano.iguais}</dd>
          </dl>
          {estado.avisos.length > 0 && (
            <details>
              <summary>{estado.avisos.length} aviso(s)</summary>
              <ul className="historico">
                {estado.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="acoes">
            <button className="botao-secundario" onClick={() => setEstado({ etapa: 'escolher' })}>
              Voltar
            </button>
            <button className="botao-principal" onClick={() => void gravar(estado.plano)} disabled={!estado.plano.novos.length && !estado.plano.atualizar.length}>
              Gravar
            </button>
          </div>
        </section>
      )}
      {estado.etapa === 'gravando' && (
        <p className="vazio">
          Gravando {estado.feito} de {estado.total}…
        </p>
      )}
      {estado.etapa === 'pronto' && <p className="mensagem">{estado.mensagem} Eles vão para o servidor na próxima sincronização.</p>}
    </Tela>
  );
}
