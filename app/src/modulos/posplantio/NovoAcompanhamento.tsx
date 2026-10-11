/** Acompanhamento do plantio (relato do solicitante ou vistoria da equipe): mudas vivas e fotos. */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { bloqueiosMonitoramento } from '@crads/dominio';
import { Icone } from '../../componentes/Icone';
import { Tela } from '../../componentes/Tela';
import { useApp } from '../../contexto';
import { acompanharPosicao, type PosicaoGps } from '../../plataforma/gps';
import { nomesEspecies } from '../coleta/dados';
import { gravarFoto, type FotoPendente } from '../matrizes/fotos';
import { resumoPlantio } from './dados';
import { FotosComGps } from './FotosComGps';

export function NovoAcompanhamento() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const vistoria = params.get('tipo') === 'vistoria';
  const { db, repo } = useApp();
  const navegar = useNavigate();
  const plantio = useLiveQuery(() => db.colecao('plantio').get(id!), [id]);
  const resumo = useLiveQuery(() => resumoPlantio(db, id!), [id]);
  const nomes = useLiveQuery(() => nomesEspecies(db), [db]);
  const [vivas, setVivas] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<FotoPendente[]>([]);
  const [gps, setGps] = useState<PosicaoGps | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => acompanharPosicao(setGps, () => {}), []);

  if (!plantio || !resumo) return <Tela titulo="Acompanhamento">{null}</Tela>;
  const plantadas = new Map(resumo.sobrevivencia.por_especie.map((e) => [e.especie_id, e.plantadas]));
  const mapaVivas = new Map([...plantadas.keys()].map((e) => [e, Number(vivas[e] ?? '')]));

  async function salvar() {
    const faltando = [...mapaVivas].filter(([e]) => vivas[e] === undefined || vivas[e] === '').length;
    const b = [...bloqueiosMonitoramento(plantadas, new Map([...mapaVivas].filter(([e]) => vivas[e] !== undefined && vivas[e] !== '')), nomes), ...(faltando ? ['Conte as mudas vivas de todas as espécies.'] : [])];
    setErros(b);
    if (b.length) return;
    setSalvando(true);
    const base = { viveiro_id: plantio!.viveiro_id, solicitante_usuario_id: plantio!.solicitante_usuario_id ?? null };
    const m = await repo.salvar('monitoramento', { ...base, plantio_id: id, data: new Date().toISOString().slice(0, 10), tipo: vistoria ? 'vistoria' : 'relato', observacao: observacao || null });
    for (const [e, v] of mapaVivas) await repo.salvar('monitoramento_item', { ...base, monitoramento_id: m.id, especie_id: e, plantadas: plantadas.get(e), vivas: v });
    for (const f of fotos) await gravarFoto(db, repo, 'monitoramento', m.id, String(plantio!.viveiro_id), f);
    navegar(`/pos-plantio/${id}?acompanhado=1`, { replace: true });
  }

  return (
    <Tela titulo={vistoria ? 'Vistoria' : 'Como estão as mudas?'}>
      <div className="assistente">
        <h2 className="pergunta">Quantas estão vivas?</h2>
        <ul className="lista">
          {[...plantadas].map(([e, p]) => (
            <li key={e} className="item-lista">
              <div>
                <strong>{nomes?.get(e) ?? e}</strong>
                <small>plantadas: {p}</small>
              </div>
              <input
                className="campo-contagem"
                type="number"
                inputMode="numeric"
                min="0"
                max={p}
                aria-label={`Vivas de ${nomes?.get(e) ?? e}`}
                value={vivas[e] ?? ''}
                onChange={(ev) => setVivas({ ...vivas, [e]: ev.target.value })}
              />
            </li>
          ))}
        </ul>
        <h2 className="pergunta">Fotos</h2>
        <FotosComGps fotos={fotos} aoMudar={setFotos} gps={gps} />
        <label className="formulario">
          Observação (opcional)
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </label>
        {erros.map((e) => (
          <p key={e} className="erro">
            {e}
          </p>
        ))}
        <button className="botao-principal" disabled={salvando} onClick={() => void salvar()}>
          <Icone nome="certo" /> Salvar acompanhamento
        </button>
      </div>
    </Tela>
  );
}
