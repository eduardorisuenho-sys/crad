/** Registro do plantio de uma doação retirada (funciona sem internet). */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { bloqueiosPlantio } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { nomesEspecies } from '../coleta/dados';
import { gravarFoto, type FotoPendente } from '../matrizes/fotos';
import { entreguesDaDoacao } from './dados';
import { FotosComGps } from './FotosComGps';

type Etapa = 'quantidades' | 'local' | 'fotos';

export function RegistrarPlantio() {
  const { doacaoId } = useParams();
  const { db, repo } = useApp();
  const navegar = useNavigate();
  const doacao = useLiveQuery(() => db.colecao('doacao').get(doacaoId!), [doacaoId]);
  const entregues = useLiveQuery(() => entreguesDaDoacao(db, doacaoId!), [doacaoId]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [etapa, setEtapa] = useState<Etapa>('quantidades');
  const [plantadas, setPlantadas] = useState<Record<string, string>>({});
  const [gps, setGps] = useState<PosicaoGps | null>(null);
  const [ponto, setPonto] = useState<PosicaoGps | null>(null);
  const [local, setLocal] = useState({ municipio: '', descricao: '', data: new Date().toISOString().slice(0, 10) });
  const [fotos, setFotos] = useState<FotoPendente[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => acompanharPosicao(setGps, () => {}), []);

  if (!doacao || !entregues) return <Tela titulo="Registrar plantio">{null}</Tela>;
  const qtd = (e: string) => Number(plantadas[e] ?? entregues.get(e) ?? 0);
  const mapaPlantadas = new Map([...entregues.keys()].map((e) => [e, qtd(e)]));

  async function salvar() {
    setSalvando(true);
    const base = { viveiro_id: doacao!.viveiro_id, solicitante_usuario_id: doacao!.solicitante_usuario_id ?? null };
    const p = await repo.salvar('plantio', {
      ...base,
      doacao_id: doacaoId,
      data: local.data,
      geometria: ponto ? { type: 'Point', coordinates: [ponto.lon, ponto.lat] } : null,
      local: [local.municipio, local.descricao].filter(Boolean).join(' · ') || null,
    });
    for (const [e, q] of mapaPlantadas) if (q > 0) await repo.salvar('plantio_item', { ...base, plantio_id: p.id, especie_id: e, quantidade: q });
    for (const f of fotos) await gravarFoto(db, repo, 'plantio', p.id, String(doacao!.viveiro_id), f);
    navegar(`/pos-plantio/${p.id}?novo=1`, { replace: true });
  }

  return (
    <Tela titulo={`Plantio ${String(doacao.codigo)}`}>
      {etapa === 'quantidades' && (
        <div className="assistente">
          <h2 className="pergunta">Quantas mudas foram plantadas?</h2>
          <ul className="lista">
            {[...entregues].map(([e, ent]) => (
              <li key={e} className="item-lista">
                <div>
                  <strong>{nomes?.get(e) ?? e}</strong>
                  <small>recebidas: {ent}</small>
                </div>
                <input
                  className="campo-contagem"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={ent}
                  aria-label={`Plantadas de ${nomes?.get(e) ?? e}`}
                  value={plantadas[e] ?? String(ent)}
                  onChange={(ev) => setPlantadas({ ...plantadas, [e]: ev.target.value })}
                />
              </li>
            ))}
          </ul>
          {erros.map((e) => (
            <p key={e} className="erro">
              {e}
            </p>
          ))}
          <button
            className="botao-principal"
            onClick={() => {
              const b = bloqueiosPlantio(entregues, mapaPlantadas, nomes);
              setErros(b);
              if (!b.length) setEtapa('local');
            }}
          >
            Continuar
          </button>
        </div>
      )}

      {etapa === 'local' && (
        <div className="formulario">
          <h2 className="pergunta">Onde foram plantadas?</h2>
          <button type="button" className={`botao-grande ${ponto ? 'ativo' : ''}`} disabled={!gps} onClick={() => setPonto(gps)}>
            <Icone nome="plantio" tamanho={40} />
            <span>{ponto ? `Ponto marcado (±${ponto.precisao_m} m)` : gps ? 'Estou no local: marcar o ponto' : 'Procurando o GPS…'}</span>
          </button>
          <label>
            Município
            <input value={local.municipio} onChange={(e) => setLocal({ ...local, municipio: e.target.value })} />
          </label>
          <label>
            Como chegar (opcional)
            <input value={local.descricao} onChange={(e) => setLocal({ ...local, descricao: e.target.value })} />
          </label>
          <label>
            Data do plantio
            <input type="date" value={local.data} onChange={(e) => setLocal({ ...local, data: e.target.value })} />
          </label>
          <button className="botao-principal" onClick={() => setEtapa('fotos')}>
            Continuar
          </button>
          <button className="botao-secundario" onClick={() => setEtapa('quantidades')}>
            <Icone nome="voltar" /> Voltar
          </button>
        </div>
      )}

      {etapa === 'fotos' && (
        <div className="assistente">
          <h2 className="pergunta">Fotos do plantio</h2>
          <FotosComGps fotos={fotos} aoMudar={setFotos} gps={gps} />
          <button className="botao-principal" disabled={!fotos.length || salvando} onClick={() => void salvar()}>
            <Icone nome="certo" /> Salvar plantio
          </button>
          <button className="botao-secundario" onClick={() => setEtapa('local')}>
            <Icone nome="voltar" /> Voltar
          </button>
        </div>
      )}
    </Tela>
  );
}
