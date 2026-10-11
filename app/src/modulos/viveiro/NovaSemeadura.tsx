/** Semeadura: tira sementes de um lote LS e cria o lote de mudas LM. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bloqueioSaida, ehProvisorio, proximoCodigoLoteMudas } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { CAMPO_DECIMAL, lerNumero } from '../../plataforma/numero';
import { nomesEspecies } from '../coleta/dados';
import { lotesSementesComSaldo, RECIPIENTES } from './dados';

type Etapa = 'lote' | 'quantidade' | 'recipiente' | 'conferir';

export function NovaSemeadura() {
  const { repo, db } = useApp();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [etapa, setEtapa] = useState<Etapa>(params.get('ls') ? 'quantidade' : 'lote');
  const [lsId, setLsId] = useState(params.get('ls') ?? '');
  const [sementes, setSementes] = useState('');
  const [gramas, setGramas] = useState('');
  const [recipiente, setRecipiente] = useState('tubete');
  const [canteiro, setCanteiro] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const lotes = useLiveQuery(() => lotesSementesComSaldo(repo), [repo]) ?? [];
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const ls = lotes.find((l) => l.lote.id === lsId);

  // Sem contar as sementes, estima pelo peso (sementes ÷ peso do lote).
  const g = lerNumero(gramas);
  const estimadas = ls && g && ls.lote.peso_g && ls.lote.sementes_estimadas ? Math.round((g * Number(ls.lote.sementes_estimadas)) / Number(ls.lote.peso_g)) : null;
  const n = lerNumero(sementes) ?? estimadas;

  function conferirQuantidade() {
    setErro('');
    if (!n && !g) return setErro('Informe o número de sementes ou o peso.');
    const b = bloqueioSaida({ g: ls!.g, unid: ls!.unid || Infinity }, { g, unid: lerNumero(sementes) });
    if (b) return setErro(b);
    setEtapa('recipiente');
  }

  async function salvar() {
    setSalvando(true);
    const existentes = (await db.colecao('lote_mudas').toArray()).map((l) => String(l.codigo));
    const codLS = String(ls!.lote.codigo);
    const codigo = ehProvisorio(codLS) ? await repo.codigoProvisorio('LM') : proximoCodigoLoteMudas(codLS, existentes);
    const hoje = new Date().toISOString().slice(0, 10);
    const lm = await repo.salvar('lote_mudas', {
      codigo,
      lote_sementes_id: lsId,
      especie_id: ls!.lote.especie_id,
      data_semeadura: hoje,
      sementes_semeadas: n ?? null,
      sementes_semeadas_g: g,
      recipiente,
      canteiro: canteiro || null,
      fase_atual: 'semeadura',
      situacao: 'ativo',
    });
    await repo.salvar('movimento_sementes', { lote_sementes_id: lsId, tipo: 'semeadura', quantidade_g: g, quantidade_unid: lerNumero(sementes), data: hoje, lote_mudas_id: lm.id });
    await repo.salvar('evento_lote_mudas', { lote_mudas_id: lm.id, tipo: 'semeadura', data: hoje, quantidade: n ?? null, observacao: canteiro ? `canteiro ${canteiro}` : null });
    navegar(`/viveiro/lotes/${lm.id}?novo=1`, { replace: true });
  }

  const voltar = (para: Etapa) => (
    <button className="botao-secundario" onClick={() => setEtapa(para)}>
      <Icone nome="voltar" /> Voltar
    </button>
  );
  const cabecalho = ls && (
    <p className="contador">
      {String(ls.lote.codigo)} · {nomes?.get(String(ls.lote.especie_id)) ?? ''} · {ls.g} g
    </p>
  );

  return (
    <Tela titulo="Nova semeadura">
      {etapa === 'lote' && (
        <div className="assistente">
          <h2 className="pergunta">De qual lote de sementes?</h2>
          <ul className="lista">
            {lotes.map((l) => (
              <li key={l.lote.id}>
                <button
                  className="item-lista botao-lista"
                  onClick={() => {
                    setLsId(l.lote.id);
                    setEtapa('quantidade');
                  }}
                >
                  <Icone nome="semente" />
                  <div>
                    <strong>
                      {String(l.lote.codigo)} · {nomes?.get(String(l.lote.especie_id)) ?? ''}
                    </strong>
                    <small>
                      {l.g} g{l.unid ? ` · ${l.unid} sementes` : ''}
                    </small>
                  </div>
                </button>
              </li>
            ))}
            {!lotes.length && <li className="vazio">Nenhum lote de sementes com saldo.</li>}
          </ul>
        </div>
      )}

      {etapa === 'quantidade' && ls && (
        <div className="formulario">
          {cabecalho}
          <h2 className="pergunta">Quanto vai semear?</h2>
          <label>
            Número de sementes
            <input type="number" inputMode="numeric" min="1" step="1" value={sementes} onChange={(e) => setSementes(e.target.value)} />
          </label>
          <label>
            Peso (gramas)
            <input {...CAMPO_DECIMAL} value={gramas} onChange={(e) => setGramas(e.target.value)} />
          </label>
          {!sementes && estimadas ? <p className="dica">Pelo peso, são cerca de {estimadas} sementes.</p> : null}
          {erro && <p className="erro">{erro}</p>}
          <button className="botao-principal" onClick={conferirQuantidade}>
            Continuar
          </button>
          {voltar('lote')}
        </div>
      )}

      {etapa === 'recipiente' && (
        <div className="assistente">
          {cabecalho}
          <h2 className="pergunta">Onde vai semear?</h2>
          <div className="meses">
            {RECIPIENTES.map((r) => (
              <button key={r.valor} type="button" className={`chip ${recipiente === r.valor ? 'ativo' : ''}`} onClick={() => setRecipiente(r.valor)}>
                {r.rotulo}
              </button>
            ))}
          </div>
          <label className="formulario">
            Canteiro (opcional)
            <input value={canteiro} onChange={(e) => setCanteiro(e.target.value)} placeholder="Ex.: C3" />
          </label>
          <button className="botao-principal" onClick={() => setEtapa('conferir')}>
            Continuar
          </button>
          {voltar('quantidade')}
        </div>
      )}

      {etapa === 'conferir' && ls && (
        <div className="assistente">
          <h2 className="pergunta">Confira</h2>
          <dl className="ficha">
            <dt>Lote de sementes</dt>
            <dd>
              {String(ls.lote.codigo)} · {nomes?.get(String(ls.lote.especie_id)) ?? ''}
            </dd>
            <dt>Semeadas</dt>
            <dd>
              {n ?? '?'} sementes{g ? ` (${g} g)` : ''}
            </dd>
            <dt>Recipiente</dt>
            <dd>
              {RECIPIENTES.find((r) => r.valor === recipiente)?.rotulo}
              {canteiro ? ` · canteiro ${canteiro}` : ''}
            </dd>
          </dl>
          <button className="botao-principal" disabled={salvando} onClick={() => void salvar()}>
            <Icone nome="certo" /> Criar lote de mudas
          </button>
          {voltar('recipiente')}
        </div>
      )}
    </Tela>
  );
}
